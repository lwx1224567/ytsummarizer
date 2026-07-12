# Data Model: Translation Output in Knowledge Notes

**Feature**: 003-translation-output
**Date**: 2026-07-11

## Entities

### 1. Translation

| Field | Type | Description |
|-------|------|-------------|
| `sourceText` | string | The summary text to translate (may include Markdown formatting) |
| `targetLanguage` | string | Human-readable target language name (e.g., "Chinese", "Japanese") |
| `translatedText` | string | The translated output text (preserves Markdown formatting) |
| `error` | string? | Error message if translation failed; null/undefined on success |

**Lifecycle**:
1. Created after summary generation completes successfully
2. If sourceText is empty or targetLanguage is "Auto"/"English" → skipped (not created)
3. If LLM call succeeds → translatedText populated, error is null
4. If LLM call fails → translatedText is empty, error contains failure reason

**Validation Rules**:
- `sourceText` must be non-empty (skip translation if no summary content)
- `targetLanguage` must be one of: "Chinese", "Japanese", "Korean", "Spanish", "French", "German", "English", "Auto"
- `sourceText` max length: same as summary (bounded by `maxTokens` setting × 4 ≈ 40000 chars)
- Translation timeout: 60 seconds (same as streaming summary timeout)

### 2. Knowledge Note (existing entity, modified)

The note structure when translation is enabled:

```markdown
[url](url)

## Summary
{summaryText}

## {Language}翻译 (Translation)
{translatedText | errorMessage}

## Transcript
> [!faq]- Transcript Content
> **[00:00]** transcript text...
```

**Modification from current state**: Added `## Translation` section between Summary and Transcript.

**State Transitions**:

```
Create Note
  ├── Fetch transcript
  ├── Generate summary (streaming or segmented)
  ├── [NEW] If targetLanguage ≠ Auto/English:
  │     ├── Generate translation
  │     ├── Success → write Translation section
  │     └── Failure → write error in Translation section
  └── Write Transcript section
```

### 3. LLMProvider Interface (existing entity, modified)

New method added:

| Method | Signature |
|--------|-----------|
| `translateText` | `(text: string, targetLanguage: string) => Promise<string>` |
| `isConfigured` | `() => boolean` (existing — reused) |

**Note**: No new settings fields needed. The existing `targetLanguage` field in
`LLMSettings` serves as the translation target language.
