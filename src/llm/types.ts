export interface LLMSettings {
	provider: string;
	apiKey: string;
	baseURL: string;
	model: string;
	customPrompt: string;
	maxTokens: number;
}

export interface LLMProvider {
	generateSummary(
		transcript: string,
		title: string,
		url: string,
	): Promise<string>;
	/**
	 * Streaming variant of generateSummary. Calls `onChunk` for each text delta
	 * received from the LLM, then resolves with the full accumulated text.
	 *
	 * If the stream fails before any content is received, falls back to
	 * non-streaming `generateSummary()`. If it fails after partial content,
	 * preserves the partial text and falls back.
	 */
	generateSummaryStream(
		transcript: string,
		title: string,
		url: string,
		onChunk: (chunk: string) => void,
	): Promise<string>;
	updateSettings(settings: LLMSettings): void;
	isConfigured(): boolean;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
	provider: "openai",
	apiKey: "",
	baseURL: "",
	model: "gpt-4o-mini",
	customPrompt:
		"You are an assistant that summarizes YouTube video transcripts. Summarize the given transcript in a concise, clear, and understandable way. Highlight important points and remove unnecessary details.",
	maxTokens: 1000,
};
