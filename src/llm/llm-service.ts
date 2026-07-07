import { LLMProvider, LLMSettings } from "./types";
import { OpenAICompatibleProvider } from "./openai-compatible-provider";

/**
 * Factory for the LLM provider. All current presets speak the OpenAI-compatible
 * protocol, so they share one implementation. Future non-compatible backends
 * (e.g. Anthropic native SDK) can be branched here without touching callers.
 */
export function createLLMProvider(settings: LLMSettings): LLMProvider {
	return new OpenAICompatibleProvider(settings);
}
