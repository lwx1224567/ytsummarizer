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

interface YTranscriptSettings {
	timestampMod: number;
	lang: string;
	country: string;
	leafUrls: string[];
	llm: LLMSettings;
}

const DEFAULT_SETTINGS: YTranscriptSettings = {
	timestampMod: 5,
	lang: "en",
	country: "EN",
	leafUrls: [],
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
		leaf.setEphemeralState({
			url,
		});
	}

	async createNewPageWithTranscript(url: string) {
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

				const summary = await this.llmService.generateSummaryStream(
					transcriptText,
					data.title,
					url,
					(chunk: string) => {
						streamedSummary += chunk;
						debouncedFlush();
					},
				);

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
			new Notice("An error occurred while creating the transcript!");
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
			};
			delete raw.openai;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
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

		new Setting(containerEl)
			.setName("Timestamp interval")
			.setDesc(
				"Indicates how often timestamp should occur in text (1 - every line, 10 - every 10 lines)",
			)
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
			.setName("Language")
			.setDesc("Preferred transcript language")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.lang)
					.onChange(async (value) => {
						this.plugin.settings.lang = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Country")
			.setDesc("Preferred transcript country code")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.country)
					.onChange(async (value) => {
						this.plugin.settings.country = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("LLM provider")
			.setHeading();

		const preset = getProviderPreset(this.plugin.settings.llm.provider);

		new Setting(containerEl)
			.setName("Provider")
			.setDesc(
				"Backend for summaries. Free/cheap options: 智谱 GLM-4-Flash (free), Gemini (free tier), Ollama (local/free), DeepSeek (very cheap).",
			)
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
			.setName("API base URL")
			.setDesc("OpenAI-compatible endpoint. Leave empty for official OpenAI.")
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
			.setName("API key")
			.setDesc(
				!preset || preset.needsApiKey
					? preset && preset.helpUrl
						? `Get your key from ${preset.helpUrl}`
						: "Enter your API key"
					: "Ollama does not require an API key — leave empty.",
			)
			.addText((text) => {
				if (preset && !preset.needsApiKey) {
					text.setDisabled(true);
					text.setPlaceholder("(not required)");
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
			.setName("Model")
			.setDesc(
				preset && preset.allowCustomModel
					? "Enter the model name (e.g. qwen2.5, llama3.2; for MiMo run `ollama pull` first)"
					: "Select the model to use",
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
			.setName("Custom summary prompt")
			.setDesc("Enter a custom prompt to use when generating summaries. Leave empty to use the default prompt.")
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
			.setName("Max tokens")
			.setDesc("Maximum number of tokens to generate for the summary (10-10000)")
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
				.setName("Segmented summary threshold")
				.setDesc(
					"Transcripts exceeding this estimated token count will be split into chunks, " +
					"each summarized independently, then merged. Lower = trigger segmentation more often. " +
					"Default 4000 tokens (~16K characters). Set higher if your model has a large context window.",
				)
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
	}
}
