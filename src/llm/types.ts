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
