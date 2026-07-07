import { OpenAI } from "openai";
import { Notice } from "obsidian";
import {
	DEFAULT_LLM_SETTINGS,
	LLMProvider,
	LLMSettings,
	SegmentedSummaryResult,
	ChunkSummary,
} from "./types";
import { getProviderPreset } from "./provider-registry";
import { splitTranscript, estimateTokens } from "../render-utils";

/**
 * Generic provider that talks to any OpenAI-compatible /v1/chat/completions
 * endpoint (OpenAI, DeepSeek, 智谱 GLM, Gemini OpenAI-compat, Ollama, custom).
 * Switching backend is just baseURL + apiKey + model.
 */
export class OpenAICompatibleProvider implements LLMProvider {
	private client: OpenAI | null = null;
	private settings: LLMSettings;

	constructor(settings: LLMSettings) {
		this.settings = settings;
		this.rebuildClient();
	}

	private rebuildClient() {
		const preset = getProviderPreset(this.settings.provider);
		const needsKey = preset ? preset.needsApiKey : true;
		if (needsKey && !this.settings.apiKey) {
			this.client = null;
			return;
		}
		try {
			const opts = {
				apiKey: this.settings.apiKey || "ollama",
				dangerouslyAllowBrowser: true,
				...(this.settings.baseURL ? { baseURL: this.settings.baseURL } : {}),
			};
			this.client = new OpenAI(opts);
		} catch (error) {
			console.error("LLM client initialization failed:", error);
			new Notice("Failed to initialize LLM client. Please check your settings.");
			this.client = null;
		}
	}

	public updateSettings(settings: LLMSettings) {
		this.settings = settings;
		this.rebuildClient();
	}

	public isConfigured(): boolean {
		return this.client !== null;
	}

	public async generateSummaryStream(
		transcript: string,
		title: string,
		url: string,
		onChunk: (chunk: string) => void,
	): Promise<string> {
		if (!this.client) {
			throw new Error(
				"LLM is not configured. Please set your API key / endpoint in the plugin settings.",
			);
		}

		const systemPrompt =
			this.settings.customPrompt.trim() || DEFAULT_LLM_SETTINGS.customPrompt;

		const langInstruction = this.getLanguageInstruction();

		const messages = [
			{ role: "system" as const, content: systemPrompt },
			{
				role: "user" as const,
				content: `Video Title: ${title}\n\nTranscript:\n${transcript}\n\nPlease summarize this video.${langInstruction} To create links to relevant sections where the user requests, here is the video link: ${url}`,
			},
		];

		let fullText = "";

		try {
			const stream = await this.client.chat.completions.create({
				model: this.settings.model,
				messages,
				temperature: 0.7,
				max_tokens: this.settings.maxTokens,
				stream: true,
			});

			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content || "";
				if (content) {
					fullText += content;
					onChunk(content);
				}
			}

			return fullText || "Failed to generate summary.";
		} catch (error) {
			console.warn(
				"Streaming failed, falling back to non-streaming:",
				error,
			);

			// If we already have partial text, call onChunk with an error note
			// so the caller can preserve it, then fall back.
			if (fullText) {
				const errorNote =
					"\n\n*[Streaming interrupted, retrying with non-streaming...]*";
				fullText += errorNote;
				onChunk(errorNote);
			}

			// Fall back to non-streaming
			try {
				return await this.generateSummary(transcript, title, url);
			} catch (fallbackError) {
				console.error("Non-streaming fallback also failed:", fallbackError);
				const detail =
					fallbackError instanceof Error
						? fallbackError.message
						: String(fallbackError);
				throw new Error(`Summary generation failed: ${detail}`);
			}
		}
	}

		private getLanguageInstruction(): string {
			const lang = this.settings.targetLanguage;
			if (!lang || lang === "Auto" || lang === "English") return "";
			return ` Output the summary in ${lang}.`;
		}

	public async generateSummary(
		transcript: string,
		title: string,
		url: string,
	): Promise<string> {
		if (!this.client) {
			throw new Error(
				"LLM is not configured. Please set your API key / endpoint in the plugin settings.",
			);
		}

		try {
			const systemPrompt =
				this.settings.customPrompt.trim() || DEFAULT_LLM_SETTINGS.customPrompt;

				const langInstruction = this.getLanguageInstruction();

			const response = await this.client.chat.completions.create({
				model: this.settings.model,
				messages: [
					{ role: "system", content: systemPrompt },
					{
						role: "user",
						content: `Video Title: ${title}\n\nTranscript:\n${transcript}\n\nPlease summarize this video.${langInstruction} To create links to relevant sections where the user requests, here is the video link: ${url}`,
					},
				],
				temperature: 0.7,
				max_tokens: this.settings.maxTokens,
			});

			return response.choices[0]?.message?.content || "Failed to generate summary.";
		} catch (error) {
			console.error("LLM API error:", error);
			const detail = error instanceof Error ? error.message : String(error);
			throw new Error(`Summary generation failed: ${detail}`);
		}
	}

	public async generateSegmentedSummary(
		transcript: string,
		title: string,
		url: string,
		onProgress?: (phase: string, done: number, total: number) => void,
	): Promise<SegmentedSummaryResult> {
		if (!this.client) {
			throw new Error(
				"LLM is not configured. Please set your API key / endpoint in the plugin settings.",
			);
		}

		const chunkTokens = this.settings.segmentedThreshold || 4000;
		const chunks = splitTranscript(transcript, chunkTokens);

		// Single chunk — no need for map-reduce
		if (chunks.length <= 1) {
			const summary = await this.generateSummary(transcript, title, url);
			return {
				chunkSummaries: [{ index: 1, summary }],
				mergedSummary: summary,
			};
		}

		// ── Map phase: summarize each chunk ──
		const chunkSummaries: ChunkSummary[] = [];
		const mapPrompt =
			this.settings.customPrompt.trim() || DEFAULT_LLM_SETTINGS.customPrompt;

			const langInstruction = this.getLanguageInstruction();

		for (let i = 0; i < chunks.length; i++) {
			if (onProgress) {
				onProgress("map", i + 1, chunks.length);
			}

			try {
				const response = await this.client.chat.completions.create({
					model: this.settings.model,
					messages: [
						{ role: "system", content: mapPrompt },
						{
							role: "user",
							content:
								`Video Title: ${title}\n\n` +
								`This is part ${i + 1} of ${chunks.length} of the transcript.\n\n` +
								`Transcript (Part ${i + 1}/${chunks.length}):\n${chunks[i]}\n\n` +
								`Please summarize this part of the video.${langInstruction} Focus on the key points in this section.`,
						},
					],
					temperature: 0.7,
					max_tokens: this.settings.maxTokens,
				});

				const text =
					response.choices[0]?.message?.content ||
					`Failed to summarize part ${i + 1}.`;

				chunkSummaries.push({ index: i + 1, summary: text });
			} catch (error) {
				console.error(`Chunk ${i + 1} summary failed:`, error);
				chunkSummaries.push({
					index: i + 1,
					summary: "",
					error: `Failed to summarize part ${i + 1}.`,
				});
			}
		}

		// ── Reduce phase: merge chunk summaries ──
		if (onProgress) {
			onProgress("reduce", chunks.length, chunks.length);
		}

		let mergedSummary = "";
		try {
			const summariesText = chunkSummaries
				.map(
					(c) =>
						`### Part ${c.index} Summary\n${c.summary}` +
						(c.error ? `\n(Error: ${c.error})` : ""),
				)
				.join("\n\n");

			const mergeResponse = await this.client.chat.completions.create({
				model: this.settings.model,
				messages: [
					{
						role: "system",
						content:
							"You are an assistant that merges multiple section summaries into one coherent overall summary. Remove duplicate points, organize logically, and produce a clean final summary.",
					},
					{
						role: "user",
						content:
							`Video Title: ${title}\n` +
							`Video URL: ${url}\n\n` +
							`The following are summaries of ${chunks.length} sections of the same video transcript. ` +
							`Please merge them into a single coherent summary.${langInstruction} Eliminate duplicate information ` +
							`and organize the key points in a logical order.\n\n${summariesText}`,
					},
				],
				temperature: 0.7,
				max_tokens: this.settings.maxTokens * 2,
			});

			mergedSummary =
				mergeResponse.choices[0]?.message?.content ||
				"Failed to merge summaries.";
		} catch (error) {
			console.error("Merge summaries failed:", error);
			mergedSummary = "Failed to merge section summaries.";
		}

		return { chunkSummaries, mergedSummary };
	}
}
