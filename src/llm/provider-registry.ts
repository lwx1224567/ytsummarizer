export interface ProviderModel {
	value: string;
	label: string;
}

export interface ProviderPreset {
	id: string;
	label: string;
	baseURL: string;
	models: ProviderModel[];
	needsApiKey: boolean;
	apiKeyPlaceholder: string;
	allowCustomModel: boolean;
	helpUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
	{
		id: "openai",
		label: "OpenAI",
		baseURL: "",
		models: [
			{ value: "gpt-4o-mini", label: "GPT-4o Mini (便宜)" },
			{ value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
			{ value: "gpt-4o", label: "GPT-4o (贵)" },
		],
		needsApiKey: true,
		apiKeyPlaceholder: "sk-...",
		allowCustomModel: false,
		helpUrl: "https://platform.openai.com/api-keys",
	},
	{
		id: "deepseek",
		label: "DeepSeek (深度求索, 极便宜)",
		baseURL: "https://api.deepseek.com/v1",
		models: [
			{ value: "deepseek-chat", label: "DeepSeek-V3 (chat)" },
			{ value: "deepseek-reasoner", label: "DeepSeek-R1 (推理)" },
		],
		needsApiKey: true,
		apiKeyPlaceholder: "sk-...",
		allowCustomModel: false,
		helpUrl: "https://platform.deepseek.com/api_keys",
	},
	{
		id: "zhipu",
		label: "智谱 GLM (glm-4-flash 免费)",
		baseURL: "https://open.bigmodel.cn/api/paas/v4",
		models: [
			{ value: "glm-4-flash", label: "GLM-4-Flash (免费)" },
			{ value: "glm-4-flashx", label: "GLM-4-FlashX (免费)" },
			{ value: "glm-4-air", label: "GLM-4-Air (便宜)" },
			{ value: "glm-4-plus", label: "GLM-4-Plus" },
		],
		needsApiKey: true,
		apiKeyPlaceholder: "xxx.xxx",
		allowCustomModel: false,
		helpUrl: "https://open.bigmodel.cn/usercenter/apikeys",
	},
	{
		id: "gemini",
		label: "Google Gemini (有免费额度)",
		baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
		models: [
			{ value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
			{ value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
			{ value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
		],
		needsApiKey: true,
		apiKeyPlaceholder: "AIza...",
		allowCustomModel: false,
		helpUrl: "https://aistudio.google.com/apikey",
	},
	{
		id: "ollama",
		label: "Ollama (本地, 完全免费/离线)",
		baseURL: "http://localhost:11434/v1",
		models: [
			{ value: "llama3.2", label: "llama3.2" },
			{ value: "qwen2.5", label: "qwen2.5" },
			{ value: "deepseek-r1:7b", label: "deepseek-r1:7b" },
		],
		needsApiKey: false,
		apiKeyPlaceholder: "ollama (任意值, 可留空)",
		allowCustomModel: true,
		helpUrl: "https://ollama.com/library",
	},
	{
		id: "custom",
		label: "自定义 (OpenAI 兼容)",
		baseURL: "",
		models: [],
		needsApiKey: true,
		apiKeyPlaceholder: "sk-...",
		allowCustomModel: true,
		helpUrl: "",
	},
];

export function getProviderPreset(id: string): ProviderPreset | undefined {
	return PROVIDER_PRESETS.find((p) => p.id === id);
}
