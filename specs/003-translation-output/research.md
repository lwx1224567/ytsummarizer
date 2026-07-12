# Research: Translation Output in Knowledge Notes

**Feature**: 003-translation-output
**Date**: 2026-07-11

## 1. Architecture: Where to add the translate method?

### Decision

Add a new `translateText()` method to the `LLMProvider` interface and implement it
in `OpenAICompatibleProvider`.

### Rationale

- The method has a distinct semantic purpose (translate text, not summarize it)
- It uses a different system prompt (translation-optimized, not
  summary-optimized)
- Keeping it separate from `generateSummary()` allows independent testing, error
  handling, and future extension (e.g., different model for translation)
- The implementation is simple (~30 lines): one non-streaming LLM call with a
  translation prompt

### Alternatives Considered

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| Reuse `generateSummary()` with a translation prompt parameter | Rejected | Abuses method semantics; harder to test; confusing API |
| Translate within `main.ts` by constructing raw API calls | Rejected | Bypasses provider abstraction; duplicates HTTP logic |
| Skip interface change, call `generateSummary` twice | Rejected | Second call with translation prompt would produce summary, not translation |

## 2. Streaming vs Non-Streaming for Translation

### Decision

Use non-streaming `generateSummary`-style call for translation.

### Rationale

- Translation produces output roughly the same length as input (the summary),
  which is typically 500-1000 tokens — fast enough that streaming adds complexity
  without proportional UX benefit
- Non-streaming means simpler error handling and no need for debounced
  `vault.process()` integration
- The summary is already complete before translation starts, so there's no "show
  progress" urgency

### Alternatives Considered

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| Streaming translation | Rejected | Over-engineering for short output; adds debounce/throttle complexity |
| Background translation (async, non-blocking) | Rejected | Adds file-update race conditions; note should be complete when user sees it |

## 3. Source Language Detection Heuristic

### Decision

Use a simple heuristic: skip translation when `targetLanguage` is `"Auto"` or
`"English"`. For all other values, generate translation.

### Rationale

- Adding a language-detection library (e.g., `franc`, `langdetect`) violates
  Principle III (Dependency Discipline)
- The `lang` transcript setting already provides rough source language context
- English is the default source assumption (most YouTube content and the
  plugin's default `lang: "en"`)
- This heuristic covers the 90% use case (English video → Chinese/Japanese/Korean
  translation)

### Alternatives Considered

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| `franc` npm package for language detection | Rejected | New dependency; 20KB+; not justified for MVP |
| Detect via LLM call (ask the model to identify language) | Rejected | Adds cost + latency to every operation |
| Sample first N chars and check character ranges (CJK heuristic) | Deferred | Low-cost enhancement for later iteration |

## 4. Translation System Prompt

### Decision

Use a fixed, built-in translation prompt separate from the user's custom summary
prompt:

```
You are a professional translator. Translate the following text into
{targetLanguage}. Preserve the original meaning, tone, and formatting (including
Markdown). Do not add, omit, or summarize any content. Output only the
translated text — no explanations, notes, or prefatory language.
```

### Rationale

- Translation is a distinct task from summarization; reusing the summary prompt
  would produce unexpected results
- The prompt enforces: accuracy (no additions/omissions), format preservation
  (Markdown), and clean output (no meta-commentary)
- Keeping it built-in means the user doesn't need to configure a separate
  translation prompt for MVP
- Can be made configurable in a future iteration if users request it

## 5. Integration with Segmented Summarization

### Decision

Translation operates on the **merged** summary, not individual chunk summaries.

### Rationale

- Translating individual chunks would require merging them afterward, which is
  redundant (the reduce phase already produces a coherent merged summary)
- A single merged summary is more coherent for translation than per-chunk
  translations stitched together
- Reduces LLM API calls (1 translation call vs N chunk translation calls)

## 6. API Design: translateText() Signature

### Decision

```typescript
translateText(
  text: string,
  targetLanguage: string,
): Promise<string>;
```

- `text`: The content to translate (summary text, may include Markdown)
- `targetLanguage`: Human-readable language name (e.g., "Chinese", "Japanese") —
  same values as the existing `targetLanguage` dropdown
- Returns: Translated text string
- Throws: Error with descriptive message on failure (network, API error, timeout)

### Rationale

- Simple signature matching the existing `generateSummary()` pattern
- Uses the same language values as the settings dropdown (consistency)
- No `title`/`url` parameters needed (translation doesn't need video context)
- No `onChunk` callback (non-streaming)

## 7. Note Structure — Section Ordering

### Decision

```
[url](url)

## Summary
[AI summary in source language]

## {Language}翻译 (Translation)
[Translated summary in target language]

## Transcript
> [!faq]- Transcript Content
> **[00:00]** transcript text...
```

### Rationale

- Summary first (most important content)
- Translation immediately follows (logical pairing with summary)
- Transcript last (reference material, in collapsible callout)
- Heading includes target language name for clarity
