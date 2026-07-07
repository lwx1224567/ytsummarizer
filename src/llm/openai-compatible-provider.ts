import { OpenAI } from "openai";
import { Notice } from "obsidian";
import { DEFAULT_LLM_SETTINGS, LLMProvider, LLMSettings } from "./types";
import { getProviderPreset } from "./provider-registry";

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

		const messages = [
			{ role: "system" as const, content: systemPrompt },
			{
				role: "user" as const,
				content: `Video Title: ${title}\n\nTranscript:\n${transcript}\n\nPlease summarize this video. To create links to relevant sections where the user requests, here is the video link: ${url}`,
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

			const response = await this.client.chat.completions.create({
				model: this.settings.model,
				messages: [
					{ role: "system", content: systemPrompt },
					{
						role: "user",
						content: `Video Title: ${title}\n\nTranscript:\n${transcript}\n\nPlease summarize this video. To create links to relevant sections where the user requests, here is the video link: ${url}`,
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
}
