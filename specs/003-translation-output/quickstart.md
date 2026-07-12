# Quickstart Validation Guide

**Feature**: 003-translation-output
**Date**: 2026-07-11

## Prerequisites

- Obsidian Desktop with YTSummarizer plugin installed
- LLM configured (any supported provider with valid API key)
- A YouTube video URL with English captions (e.g., any popular tech talk, TED talk, or tutorial)

## Validation Scenarios

### VS-1: Basic Translation (Happy Path)

**Goal**: Verify that a knowledge note includes a Translation section when target
language ≠ English.

**Setup**:
1. Open plugin settings → target language → select "中文 (Chinese)"
2. Ensure LLM is configured with valid API key

**Steps**:
1. Click the YouTube ribbon icon
2. Paste a YouTube URL with English captions
3. Select "Create New Page"
4. Wait for note generation to complete

**Expected Outcome**:
- Note contains: video link → `## Summary` (in English) → `## 中文翻译 (Chinese Translation)` (in Chinese) → `## Transcript`
- Translation content is a faithful Chinese translation of the summary
- Translation preserves any Markdown formatting from the summary
- Summary and Translation sections are both present and non-empty

### VS-2: No Translation When Language Matches

**Goal**: Verify that Translation section is NOT generated when target language is
"Auto" or "English".

**Steps**:
1. Set target language to "Auto (follow transcript)"
2. Create a new page from an English YouTube video
3. Repeat with target language set to "English"

**Expected Outcome**:
- Note contains only: video link → `## Summary` → `## Transcript`
- No Translation section present
- Behavior identical to pre-feature state

### VS-3: Translation with Segmented (Long) Transcript

**Goal**: Verify translation works correctly after map-reduce summarization.

**Steps**:
1. Set segmented threshold low (e.g., 500 tokens) in settings
2. Set target language to "中文 (Chinese)"
3. Create a new page from a video with a long transcript (>10 minutes)

**Expected Outcome**:
- Note shows segmented summarization behavior (Section Summaries callout)
- `## Summary` contains the merged summary (in English)
- `## 中文翻译 (Chinese Translation)` contains the Chinese translation of the merged summary
- Translation is a single coherent section (not per-chunk translations)

### VS-4: Translation Failure Resilience

**Goal**: Verify that summary/transcript are preserved when translation fails.

**Steps**:
1. Set target language to "中文 (Chinese)"
2. Configure an invalid API key (garbled text) or an unreachable base URL
3. Create a new page from any YouTube video

**Expected Outcome**:
- Note contains: `## Summary` (content intact) → `## 中文翻译 (Chinese Translation)` shows error message → `## Transcript` (content intact)
- No blank note — content is preserved
- Error message is descriptive (not a raw stack trace)

### VS-5: Empty Summary (Edge Case)

**Goal**: Verify graceful handling when summary generation produces no content.

**Steps**:
1. Set `maxTokens` to 1 (produces empty/truncated summary)
2. Set target language to "中文 (Chinese)"
3. Create a new page

**Expected Outcome**:
- If summary is empty: Translation section shows "No summary available for translation" (or is omitted entirely)
- Note still contains Transcript section

---

## Automated Tests

Run the Jest test suite to verify programmatic correctness:

```bash
npm test
```

New test cases to verify:
- `translateText()` returns translated text on success
- `translateText()` throws descriptive error on API failure
- `translateText()` honors timeout
- `createNewPageWithTranscript()` includes Translation section when targetLanguage ≠ "Auto"/"English"
- `createNewPageWithTranscript()` omits Translation section when targetLanguage is "Auto"
- `createNewPageWithTranscript()` preserves summary+transcript on translation failure
