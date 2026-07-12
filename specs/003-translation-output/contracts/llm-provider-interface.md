# Contract: LLMProvider Interface — translateText Method

**Feature**: 003-translation-output
**File**: `src/llm/types.ts`

## Method Addition

```typescript
export interface LLMProvider {
    // ... existing methods ...

    /**
     * Translates the provided text into the specified target language.
     *
     * Uses a fixed, built-in translation prompt optimized for accuracy and
     * Markdown preservation. This is a non-streaming, single-call operation.
     *
     * @param text        The text to translate (typically the generated summary,
     *                    may include Markdown formatting).
     * @param targetLanguage  Human-readable target language name, matching the
     *                    values in the settings dropdown (e.g., "Chinese",
     *                    "Japanese", "French").
     * @returns           The translated text. May include Markdown formatting.
     * @throws            Error with descriptive message on failure (API error,
     *                    network error, timeout, or misconfiguration).
     */
    translateText(
        text: string,
        targetLanguage: string,
    ): Promise<string>;
}
```

## Implementation Requirements

1. **Prompt**: MUST use the fixed translation system prompt defined in
   `research.md` Section 4. The user's custom summary prompt MUST NOT influence
   translation behavior.
2. **Timeout**: MUST enforce a 60-second timeout (same as streaming summary
   timeout).
3. **Error handling**: MUST throw descriptive errors. Caller is responsible for
   catching and writing error content to the Translation section.
4. **Non-streaming**: MUST use `stream: false` (default). No `onChunk` callback.
5. **Configuration**: MUST use the same provider/model/apiKey as summary
   generation. No separate translation provider configuration for MVP.
