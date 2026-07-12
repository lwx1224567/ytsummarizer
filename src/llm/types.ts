export interface LLMSettings {
	provider: string;
	apiKey: string;
	baseURL: string;
	model: string;
	customPrompt: string;
	maxTokens: number;
	/** Token threshold above which segmented (map-reduce) summarization is used. */
	segmentedThreshold: number;
	/** Target language for summary output (e.g., "Chinese", "Japanese", "English"). */
	targetLanguage: string;
}

export interface ChunkSummary {
	index: number;
	summary: string;
	error?: string;
}

export interface SegmentedSummaryResult {
	chunkSummaries: ChunkSummary[];
	mergedSummary: string;
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
	/**
	 * Map-reduce summarization for long transcripts. Splits the transcript
	 * into chunks, summarizes each independently (map phase), then merges
	 * all chunk summaries into a coherent final summary (reduce phase).
	 *
	 * Uses the provider's configured `segmentedThreshold` to decide the
	 * max tokens per chunk.
	 */
	generateSegmentedSummary(
		transcript: string,
		title: string,
		url: string,
		onProgress?: (phase: string, done: number, total: number) => void,
	): Promise<SegmentedSummaryResult>;
	/**
	 * Translates text into the specified target language.
	 *
	 * Uses a fixed, built-in translation prompt optimized for accuracy
	 * and Markdown preservation. Non-streaming, single-call operation.
	 *
	 * @param text           The text to translate (typically a summary,
	 *                       may include Markdown formatting).
	 * @param targetLanguage Human-readable language name, matching the
	 *                       values in the settings dropdown (e.g.
	 *                       "Chinese", "Japanese", "French").
	 * @returns              The translated text, preserving Markdown.
	 * @throws               Error with descriptive message on failure.
	 */
	translateText(
		text: string,
		targetLanguage: string,
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
	segmentedThreshold: 4000,
	targetLanguage: "English",
};
