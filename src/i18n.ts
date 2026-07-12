export type UILanguage = "en" | "zh";

export interface LocaleDict {
	// Settings page
	uiLanguage: string;
	uiLanguageDesc: string;
	timestampInterval: string;
	timestampIntervalDesc: string;
	language: string;
	languageDesc: string;
	country: string;
	countryDesc: string;
	llmProvider: string;
	provider: string;
	providerDesc: string;
	apiBaseUrl: string;
	apiBaseUrlDesc: string;
	apiKey: string;
	apiKeyDescDefault: string;
	apiKeyDescOllama: string;
	apiKeyDescHelpUrl: string;
	notRequired: string;
	model: string;
	modelDescSelect: string;
	modelDescCustom: string;
	maxTokens: string;
	maxTokensDesc: string;
	segmentedThreshold: string;
	segmentedThresholdDesc: string;
	targetLanguage: string;
	targetLanguageDesc: string;
	customPrompt: string;
	customPromptDesc: string;
}

const en: LocaleDict = {
	uiLanguage: "UI Language",
	uiLanguageDesc: "Language of the settings interface",
	timestampInterval: "Timestamp interval",
	timestampIntervalDesc:
		"Indicates how often timestamp should occur in text (1 - every line, 10 - every 10 lines)",
	language: "Language",
	languageDesc: "Preferred transcript language",
	country: "Country",
	countryDesc: "Preferred transcript country code",
	llmProvider: "LLM provider",
	provider: "Provider",
	providerDesc:
		"Backend for summaries. Free/cheap options: 智谱 GLM-4-Flash (free), Gemini (free tier), Ollama (local/free), DeepSeek (very cheap).",
	apiBaseUrl: "API base URL",
	apiBaseUrlDesc: "OpenAI-compatible endpoint. Leave empty for official OpenAI.",
	apiKey: "API key",
	apiKeyDescDefault: "Enter your API key",
	apiKeyDescOllama: "Ollama does not require an API key — leave empty.",
	notRequired: "(not required)",
	apiKeyDescHelpUrl: "Get your key from {url}",
	model: "Model",
	modelDescSelect: "Select the model to use",
	modelDescCustom:
		"Enter the model name (e.g. qwen2.5, llama3.2; for MiMo run `ollama pull` first)",
	maxTokens: "Max tokens",
	maxTokensDesc:
		"Maximum number of tokens to generate for the summary (10-10000)",
	segmentedThreshold: "Segmented summary threshold",
	segmentedThresholdDesc:
		"Transcripts exceeding this estimated token count will be split into chunks, " +
		"each summarized independently, then merged. Lower = trigger segmentation more often. " +
		"Default 4000 tokens (~16K characters). Set higher if your model has a large context window.",
	targetLanguage: "Target summary language",
	targetLanguageDesc:
		"Language for the output summary. LLM will translate the transcript content to this language. Select 'Auto' to use the same language as the transcript.",
	customPrompt: "Custom summary prompt",
	customPromptDesc:
		"Enter a custom prompt to use when generating summaries. Leave empty to use the default prompt.",
};

const zh: LocaleDict = {
	uiLanguage: "界面语言",
	uiLanguageDesc: "设置界面的显示语言",
	timestampInterval: "时间戳间隔",
	timestampIntervalDesc:
		"设置文本中时间戳出现的频率（1 - 每行，10 - 每10行）",
	language: "语言",
	languageDesc: "首选字幕语言",
	country: "国家",
	countryDesc: "首选字幕国家代码",
	llmProvider: "大模型提供商",
	provider: "提供商",
	providerDesc:
		"摘要生成后端。免费/便宜选项：智谱 GLM-4-Flash（免费）、Gemini（有免费额度）、Ollama（本地/免费）、DeepSeek（极便宜）。",
	apiBaseUrl: "API 基础地址",
	apiBaseUrlDesc: "OpenAI 兼容端点。留空则使用官方 OpenAI。",
	apiKey: "API 密钥",
	apiKeyDescDefault: "输入你的 API 密钥",
	apiKeyDescOllama: "Ollama 不需要 API 密钥 — 留空即可。",
	apiKeyDescHelpUrl: "从 {url} 获取你的密钥",
	notRequired: "（不需要）",
	model: "模型",
	modelDescSelect: "选择要使用的模型",
	modelDescCustom:
		"输入模型名称（例如 qwen2.5、llama3.2；使用 MiMo 请先运行 `ollama pull`）",
	maxTokens: "最大 Token 数",
	maxTokensDesc:
		"生成摘要的最大 Token 数量（10-10000）",
	segmentedThreshold: "分段摘要阈值",
	segmentedThresholdDesc:
		"超过此预估 Token 数的字幕将被分段处理，" +
		"每段独立摘要后再合并。值越低越容易触发分段。默认 4000 token（约 16000 字符）。如果模型上下文窗口较大，可适当调高。",
	targetLanguage: "摘要目标语言",
	targetLanguageDesc:
		"输出摘要的语言。LLM 会将字幕内容翻译成此语言。选择「Auto」则使用与字幕相同的语言。",
	customPrompt: "自定义摘要提示词",
	customPromptDesc:
		"输入自定义提示词用于生成摘要。留空则使用默认提示词。",
};

const locales: Record<UILanguage, LocaleDict> = { en, zh };

export function t(lang: UILanguage, key: keyof LocaleDict): string {
	return locales[lang][key];
}
