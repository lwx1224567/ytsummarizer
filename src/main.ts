import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Notice
} from "obsidian";
import { TranscriptView, TRANSCRIPT_TYPE_VIEW } from "src/transcript-view";
import { PromptModal, PromptAction } from "src/prompt-modal";
import { EditorExtensions } from "../editor-extensions";
import { createLLMProvider } from "./llm/llm-service";
import { DEFAULT_LLM_SETTINGS, LLMProvider, LLMSettings } from "./llm/types";
import { PROVIDER_PRESETS, getProviderPreset } from "./llm/provider-registry";
import { YoutubeTranscript } from "./fetch-transcript";
import { formatTimestamp } from "./timestampt-utils";
import { getTranscriptBlocks } from "./render-utils";
import { t, UILanguage } from "./i18n";

interface YTranscriptSettings {
	timestampMod: number;
	lang: string;
	country: string;
	leafUrls: string[];
	uiLanguage: UILanguage;
	llm: LLMSettings;
}

const DEFAULT_SETTINGS: YTranscriptSettings = {
	timestampMod: 5,
	lang: "en",
	country: "EN",
	leafUrls: [],
	uiLanguage: "en",
	llm: DEFAULT_LLM_SETTINGS,
};

export default class YTranscriptPlugin extends Plugin {
	settings: YTranscriptSettings;
	llmService: LLMProvider;

	async onload() {
		await this.loadSettings();

		this.llmService = createLLMProvider(this.settings.llm);

		this.registerView(
			TRANSCRIPT_TYPE_VIEW,
			(leaf) => new TranscriptView(leaf, this),
		);

		this.addRibbonIcon("youtube", "YouTube Transcript", async () => {
			const prompt = new PromptModal();
			const result = await new Promise<{ url: string, action: PromptAction }>((resolve) =>
				prompt.openAndGetValue(resolve, () => { }),
			);
			if (result && result.url) {
				if (result.action === PromptAction.SIDEBAR) {
					this.openView(result.url);
				} else if (result.action === PromptAction.NEW_PAGE) {
					this.createNewPageWithTranscript(result.url);
				}
			}
		});

		this.addCommand({
			id: "transcript-from-text",
			name: "Get YouTube transcript from selected url",
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const url = EditorExtensions.getSelectedText(editor).trim();
				this.openView(url);
			},
		});

		this.addCommand({
			id: "transcript-from-prompt",
			name: "Get YouTube transcript from url prompt",
			callback: async () => {
				const prompt = new PromptModal();
				const result = await new Promise<{ url: string, action: PromptAction }>((resolve) =>
					prompt.openAndGetValue(resolve, () => { }),
				);
				if (result && result.url) {
					if (result.action === PromptAction.SIDEBAR) {
						this.openView(result.url);
					} else if (result.action === PromptAction.NEW_PAGE) {
						this.createNewPageWithTranscript(result.url);
					}
				}
			},
		});

		this.addSettingTab(new YTranslateSettingTab(this.app, this));
	}

	async openView(url: string) {
		const leaf = this.app.workspace.getRightLeaf(false)!;
		await leaf.setViewState({
			type: TRANSCRIPT_TYPE_VIEW,
		});
		this.app.workspace.revealLeaf(leaf);
		// Call the view directly instead of relying on setEphemeralState
		const view = leaf.view as TranscriptView;
		if (view) {
			view.loadTranscript(url);
		}
	}

	async createNewPageWithTranscript(url: string) {
		let file: TFile | undefined;
		try {
			// Create a temporary file name
			const tempFileName = `YouTube Transcript - Loading...`;

			// First create an empty file
			const file = await this.app.vault.create(`${tempFileName}.md`, `Loading transcript...\n\n[${url}](${url})`);

			// Open the file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			new Notice("Getting transcript...");

			// Get YouTube transcript
			const data = await YoutubeTranscript.fetchTranscript(url, {
				lang: this.settings.lang,
				country: this.settings.country,
			});

			if (!data || !data.lines) {
				await this.app.vault.process(file, (currentContent) => `Failed to get transcript!\n\n[${url}](${url})`);
				new Notice("Failed to get transcript!");
				return;
			}

			// Create the real file name
			const randomChars = Math.random().toString(36).substring(2, 6);
			const fileName = `${data.title.replace(/[\\/:*?"<>|]/g, "_")} #${randomChars}.md`;

			// Create transcript blocks
			const blocks = getTranscriptBlocks(data.lines, this.settings.timestampMod);

			// Initialize file content
			let content = `[${url}](${url})\n\n`;

			// Update the file (adding transcript)
			content += `## Transcript\n\n`;
			content += `> [!faq]- Transcript Content\n`;

			// Add transcript content
			blocks.forEach((block) => {
				content += `> **[${formatTimestamp(block.quoteTimeOffset)}]** ${block.quote}\n>\n`;
			});

			await this.app.vault.process(file, (currentContent) => content);

			// Update file name
			await this.app.fileManager.renameFile(file, `${fileName}`);

			// Generate summary
			new Notice("Generating summary...");

			// Build plain transcript text (for LLM) and formatted (for Markdown)
			let transcriptText = "";
			const transcriptLines = data.lines.map((line) => line.text);
			transcriptText = transcriptLines.join(" ");

			let formattedTranscript = "";
			blocks.forEach((block) => {
				formattedTranscript += `> **[${formatTimestamp(block.quoteTimeOffset)}]** ${block.quote}\n>\n`;
			});

			// Write initial content with loading indicator
			let initialContent = `[${url}](${url})\n\n## Summary\n\n*Generating summary...*\n\n`;
			initialContent += `## Transcript\n\n`;
			initialContent += `> [!faq]- Transcript Content\n`;
			initialContent += formattedTranscript;

			await this.app.vault.process(file, () => initialContent);

			// Decide: streaming (short transcript) vs segmented (long transcript)
			const threshold = this.settings.llm.segmentedThreshold || 4000;
			const estimatedTokens = Math.ceil(transcriptText.length / 4);
			const needsSegmentation = estimatedTokens > threshold;

			let finalContent = `[${url}](${url})\n\n`;

			if (needsSegmentation) {
				// ── Segmented (map-reduce) path ──
				const progressNotice = new Notice("Summarizing long transcript (0%)...", 0);

				const result = await this.llmService.generateSegmentedSummary(
					transcriptText,
					data.title,
					url,
					(phase: string, done: number, total: number) => {
						if (phase === "map") {
							const pct = Math.round((done / total) * 100);
							progressNotice.setMessage(
								`Summarizing part ${done}/${total} (${pct}%)...`,
							);
						} else {
							progressNotice.setMessage("Merging section summaries...");
						}
					},
				);

				progressNotice.hide();

				// Build structured output: merged summary + section summaries
				finalContent += `## Summary\n\n${result.mergedSummary}\n\n`;

				if (result.chunkSummaries.length > 1) {
					finalContent += `> [!faq]- Section Summaries (${result.chunkSummaries.length} parts)\n`;
					result.chunkSummaries.forEach((c) => {
						if (c.error) {
							finalContent += `> **Part ${c.index}**: ${c.error}\n>\n`;
						} else {
							finalContent += `> **Part ${c.index}**: ${c.summary.replace(/\n/g, "\n> ")}\n>\n`;
						}
					});
					finalContent += `\n`;
				}

				if (!result.mergedSummary || result.mergedSummary === "Failed to merge section summaries.") {
					new Notice("Failed to generate summary!");
				}
			} else {
				// ── Streaming (single-call) path ──
				let streamedSummary = "";
				let writeTimer: ReturnType<typeof setTimeout> | null = null;

				const debouncedFlush = () => {
					if (writeTimer) clearTimeout(writeTimer);
					writeTimer = setTimeout(async () => {
						const text = streamedSummary;
						await this.app.vault.process(file, (currentContent) => {
							const transcriptIdx = currentContent.indexOf("## Transcript");
							const beforeTranscript =
								transcriptIdx >= 0
									? currentContent.substring(0, transcriptIdx)
									: currentContent;
							return `${beforeTranscript}## Summary\n\n${text}\n\n`;
						});
					}, 300);
				};

					const summary = await Promise.race([
						this.llmService.generateSummaryStream(
							transcriptText,
							data.title,
							url,
							(chunk: string) => {
								streamedSummary += chunk;
								debouncedFlush();
							},
						),
						new Promise<string>((_, reject) =>
							setTimeout(() => reject(new Error("Summary timed out after 60s. Check your API key and network.")), 60000)
						),
					]);

				// Clear pending debounce
				if (writeTimer) clearTimeout(writeTimer);

				if (summary) {
					finalContent += `## Summary\n\n${summary}\n\n`;
				} else {
					finalContent += `## Summary\n\nFailed to generate summary.\n\n`;
					new Notice("Failed to generate summary!");
				}
			}

			// Append transcript
			finalContent += `## Transcript\n\n`;
			finalContent += `> [!faq]- Transcript Content\n`;
			finalContent += formattedTranscript;

			await this.app.vault.process(file, () => finalContent);

			new Notice("Transcript and summary created!");

		} catch (error) {
			console.error("Error creating transcript:", error);
			const detail = error instanceof Error ? error.message : String(error);
			new Notice(`Failed: ${detail}`);
			// Try to update the file with error info
			try {
				const f = file;
				if (f) {
					await this.app.vault.process(f, (currentContent) => {
						const idx = currentContent.indexOf("## Transcript");
						if (idx >= 0) {
							const before = currentContent.substring(0, idx);
							return `${before}## Summary

Failed: ${detail}

`;
						}
						return currentContent;
					});
				}
			} catch (_) { /* ignore */ }
		}
	}

	onunload() {
		// Yaprakları ayırmak yerine sadece kaynakları temizle
	}

	async loadSettings() {
		const loaded = await this.loadData();
		// Migrate legacy `openai` config block into the new `llm` block.
		const raw = loaded as Record<string, unknown> | null;
		if (raw && raw.openai && !raw.llm) {
			const old = raw.openai as Record<string, unknown>;
			raw.llm = {
				provider: "openai",
				apiKey: (old.apiKey as string) ?? "",
				baseURL: "",
				model: (old.model as string) ?? "gpt-4o-mini",
				customPrompt:
					(old.customPrompt as string) ?? DEFAULT_LLM_SETTINGS.customPrompt,
				maxTokens: (old.maxTokens as number) ?? 1000,
				segmentedThreshold:
					(old.segmentedThreshold as number) ?? DEFAULT_LLM_SETTINGS.segmentedThreshold,
				targetLanguage:
					(old.targetLanguage as string) ?? DEFAULT_LLM_SETTINGS.targetLanguage,
			};
			delete raw.openai;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		// Deep-merge llm so that new fields added in future versions get defaults.
		if (this.settings.llm) {
			this.settings.llm = Object.assign({}, DEFAULT_LLM_SETTINGS, this.settings.llm);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.llmService) {
			this.llmService.updateSettings(this.settings.llm);
		}
	}
}

class YTranslateSettingTab extends PluginSettingTab {
	plugin: YTranscriptPlugin;
	values: Record<string, string>;

	constructor(app: App, plugin: YTranscriptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const lang = this.plugin.settings.uiLanguage || "en";
		function tr(key: Parameters<typeof t>[1]): string {
			return t(lang, key);
		}

		// ── UI Language ──
		new Setting(containerEl)
			.setName(tr("uiLanguage"))
			.setDesc(tr("uiLanguageDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("en", "English");
				dropdown.addOption("zh", "中文");
				dropdown
					.setValue(lang)
					.onChange(async (value) => {
						this.plugin.settings.uiLanguage = value as UILanguage;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(tr("timestampInterval"))
			.setDesc(tr("timestampIntervalDesc"))
			.addText((text) =>
				text
					.setValue(this.plugin.settings.timestampMod.toFixed())
					.onChange(async (value) => {
						const v = Number.parseInt(value);
						this.plugin.settings.timestampMod = Number.isNaN(v)
							? 5
							: v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("language"))
			.setDesc(tr("languageDesc"))
			.addText((text) =>
				text
					.setValue(this.plugin.settings.lang)
					.onChange(async (value) => {
						this.plugin.settings.lang = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("country"))
			.setDesc(tr("countryDesc"))
			.addText((text) =>
				text
					.setValue(this.plugin.settings.country)
					.onChange(async (value) => {
						this.plugin.settings.country = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("llmProvider"))
			.setHeading();

		const preset = getProviderPreset(this.plugin.settings.llm.provider);

		new Setting(containerEl)
			.setName(tr("provider"))
			.setDesc(tr("providerDesc"))
			.addDropdown((dropdown) => {
				PROVIDER_PRESETS.forEach((p) => dropdown.addOption(p.id, p.label));
				dropdown
					.setValue(this.plugin.settings.llm.provider)
					.onChange(async (value) => {
						const next = getProviderPreset(value);
						this.plugin.settings.llm.provider = value;
						if (next) {
							this.plugin.settings.llm.baseURL = next.baseURL;
							const stillValid =
								next.allowCustomModel ||
								next.models.some(
									(m) => m.value === this.plugin.settings.llm.model,
								);
							if (!stillValid && next.models.length > 0) {
								this.plugin.settings.llm.model = next.models[0].value;
							}
						}
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName(tr("apiBaseUrl"))
			.setDesc(tr("apiBaseUrlDesc"))
			.addText((text) =>
				text
					.setPlaceholder(
						preset && preset.baseURL
							? preset.baseURL
							: "https://api.openai.com/v1",
					)
					.setValue(this.plugin.settings.llm.baseURL)
					.onChange(async (value) => {
						this.plugin.settings.llm.baseURL = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("apiKey"))
			.setDesc(
				!preset || preset.needsApiKey
					? preset && preset.helpUrl
						? `Get your key from ${preset.helpUrl}`
						: tr("apiKeyDescDefault")
					: tr("apiKeyDescOllama"),
			)
			.addText((text) => {
				if (preset && !preset.needsApiKey) {
					text.setDisabled(true);
					text.setPlaceholder(tr("notRequired"));
				} else {
					text.setPlaceholder(preset ? preset.apiKeyPlaceholder : "sk-...");
					text.setValue(this.plugin.settings.llm.apiKey);
					text.onChange(async (value) => {
						this.plugin.settings.llm.apiKey = value;
						await this.plugin.saveSettings();
					});
				}
			});

		new Setting(containerEl)
			.setName(tr("model"))
			.setDesc(
				preset && preset.allowCustomModel
					? tr("modelDescCustom")
					: tr("modelDescSelect"),
			)
			.addDropdown((dropdown) => {
				if (preset && !preset.allowCustomModel) {
					preset.models.forEach((m) => dropdown.addOption(m.value, m.label));
					dropdown.setValue(this.plugin.settings.llm.model);
					dropdown.onChange(async (value) => {
						this.plugin.settings.llm.model = value;
						await this.plugin.saveSettings();
					});
				} else {
					dropdown.selectEl.style.display = "none";
				}
			})
			.addText((text) => {
				if (!preset || !preset.allowCustomModel) {
					text.inputEl.style.display = "none";
					return;
				}
				text
					.setPlaceholder(
						preset.id === "ollama"
							? "e.g. qwen2.5, llama3.2, deepseek-r1:7b"
							: "model name",
					)
					.setValue(this.plugin.settings.llm.model)
					.onChange(async (value) => {
						this.plugin.settings.llm.model = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(tr("customPrompt"))
			.setDesc(tr("customPromptDesc"))
			.addTextArea((textarea) => {
				textarea
					.setPlaceholder(DEFAULT_LLM_SETTINGS.customPrompt)
					.setValue(this.plugin.settings.llm.customPrompt)
					.onChange(async (value) => {
						this.plugin.settings.llm.customPrompt = value;
						await this.plugin.saveSettings();
					});
				textarea.inputEl.rows = 6;
				textarea.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName(tr("maxTokens"))
			.setDesc(tr("maxTokensDesc"))
			.addText((text) =>
				text
					.setPlaceholder("1000")
					.setValue(this.plugin.settings.llm.maxTokens.toString())
					.onChange(async (value) => {
						const tokens = Number.parseInt(value);
						this.plugin.settings.llm.maxTokens = Number.isNaN(tokens) || tokens < 10 || tokens > 10000
							? 1000
							: tokens;
						await this.plugin.saveSettings();
					}),
			);

			new Setting(containerEl)
				.setName(tr("segmentedThreshold"))
				.setDesc(tr("segmentedThresholdDesc"))
				.addText((text) =>
					text
						.setPlaceholder("4000")
						.setValue(this.plugin.settings.llm.segmentedThreshold.toString())
						.onChange(async (value) => {
							const tokens = Number.parseInt(value);
							this.plugin.settings.llm.segmentedThreshold = Number.isNaN(tokens) || tokens < 500
								? 4000
								: tokens;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
			.setName(tr("targetLanguage"))
			.setDesc(tr("targetLanguageDesc"))
			.addDropdown((dropdown) => {
			const languages = [
			{ value: "Auto", label: "Auto (follow transcript)" },
			{ value: "English", label: "English" },
			{ value: "Chinese", label: "中文 (Chinese)" },
			{ value: "Japanese", label: "日本語 (Japanese)" },
			{ value: "Korean", label: "한국어 (Korean)" },
			{ value: "Spanish", label: "Español (Spanish)" },
			{ value: "French", label: "Français (French)" },
			{ value: "German", label: "Deutsch (German)" },
			];
			languages.forEach((l) => dropdown.addOption(l.value, l.label));
			dropdown
			.setValue(this.plugin.settings.llm.targetLanguage)
			.onChange(async (value) => {
			this.plugin.settings.llm.targetLanguage = value;
			await this.plugin.saveSettings();
			});
			});
	}
}
