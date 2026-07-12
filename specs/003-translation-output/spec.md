# Feature Specification: Translation Output in Knowledge Notes

**Feature Branch**: `feat/translation`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "为 YTSummarizer 的 Create New Page 功能增加独立的翻译输出能力。当用户在设置中配置了目标翻译语言后，创建知识笔记时应包含：视频标题、AI 摘要（原始语言）、翻译内容（将摘要或关键内容翻译为目标语言）、以及原始字幕。翻译内容作为独立 section 出现在笔记中。"

## User Scenarios & Testing

### User Story 1 - Generate Knowledge Note with Translation (Priority: P1)

When a user creates a new knowledge note from a YouTube video and has configured a
target translation language, the note includes both the AI summary in the original
language AND a translated version of that summary as a separate section, followed
by the original transcript.

**Why this priority**: This is the core value proposition — users who consume
content across multiple languages can read the summary in their preferred language
while preserving the original for reference.

**Independent Test**: Configure a target translation language (e.g., Chinese),
fetch any English YouTube video, click "Create New Page", and verify the resulting
note contains: video title, Summary section (in English), Translation section (in
Chinese), and Transcript section.

**Acceptance Scenarios**:

1. **Given** a configured LLM and a target translation language set to "Chinese",
   **When** the user triggers "Create New Page" for an English YouTube video,
   **Then** the note contains four sections in order: video title/link, Summary
   (original language), Translation (Chinese), and Transcript (original language).
2. **Given** a configured LLM and target translation language set to "Chinese",
   **When** the summary generation completes successfully, **Then** a second LLM
   call translates the summary content and the result appears under `## 翻译
   (Translation)` before the `## Transcript` section.
3. **Given** a configured LLM and target language set to "Auto" or "English"
   (same as source), **When** the user triggers "Create New Page", **Then** no
   separate Translation section is generated (the summary alone is sufficient).

### User Story 2 - Translation with Segmented Summaries (Priority: P2)

For long transcripts that trigger segmented (map-reduce) summarization, the
translation operates on the final merged summary rather than individual chunks,
producing a single coherent translated output.

**Why this priority**: Long transcripts are a common use case; the translation
must work seamlessly with the existing segmentation feature.

**Independent Test**: Use a video with a transcript exceeding the segmentation
threshold (e.g., >4000 tokens). Verify that after the merged summary is generated,
a single Translation section appears containing the translated merged summary.

**Acceptance Scenarios**:

1. **Given** a long transcript that triggers segmented summarization and a target
   translation language is set, **When** the map-reduce process completes and the
   merged summary is produced, **Then** that merged summary is translated and
   placed in the Translation section.
2. **Given** a segmented summary where some chunk summaries failed,
   **When** the merged summary is generated (with partial errors), **Then**
   translation still proceeds on whatever merged summary text is available.

### User Story 3 - Translation Error Resilience (Priority: P3)

When the translation LLM call fails (network error, API error, timeout), the
knowledge note is still created with the summary and transcript intact; the
Translation section shows a clear error marker instead of being silently absent.

**Why this priority**: Follows the project's error resilience principle — users
should never lose content due to a secondary feature failing.

**Independent Test**: Configure an invalid API key or unreachable endpoint for the
translation provider, generate a knowledge note, and verify the note still
contains the Summary and Transcript with a "Translation failed" message in the
translation section.

**Acceptance Scenarios**:

1. **Given** a valid summary has been generated, **When** the translation API call
   fails, **Then** the note still contains the Summary and Transcript sections,
   and the Translation section displays a "Translation failed: [reason]" message.
2. **Given** the translation call times out, **When** the timeout is reached (60
   seconds), **Then** partial content (if any) is discarded and "Translation
   failed: timed out" is written in the Translation section.

---

### Edge Cases

- What happens when the target language is the same as the source transcript
  language? → Translation is skipped entirely (no redundant identical translation).
- What happens when the summary is empty? → Translation is skipped; Translation
  section shows "No summary available for translation."
- What happens when the summary is very short (1-2 sentences)? → Translation still
  proceeds; short summaries are valid translation input.
- What happens when the user changes the target language setting between generating
  the summary and translation? → Not applicable: translation happens in the same
  operation, using the setting value at the time of generation.

## Requirements

### Functional Requirements

- **FR-001**: The plugin MUST generate a separate Translation section in the
  knowledge note when the target language differs from the source transcript
  language.
- **FR-002**: The Translation section MUST appear after the Summary section and
  before the Transcript section in the note.
- **FR-003**: The translation MUST be generated via a dedicated LLM call that
  takes the completed summary as input and outputs the translated version.
- **FR-004**: The existing `targetLanguage` setting MUST serve as the translation
  target language. When set to "Auto" or a language matching the transcript's
  source, translation MUST be skipped.
- **FR-005**: When segmented (map-reduce) summarization is used, translation MUST
  operate on the final merged summary, not individual chunk summaries.
- **FR-006**: If the translation LLM call fails, the Summary and Transcript
  sections MUST still be written to the note, and the Translation section MUST
  display a descriptive error message.
- **FR-007**: When translation is enabled, the summary MUST be generated in the
  same language as the transcript source content, rather than being output
  directly in the target language. This ensures the note contains both an
  original-language summary and its translation.
- **FR-008**: The Translation section heading MUST include the target language
  name (e.g., `## 中文翻译 (Chinese Translation)`) for clarity.

### Key Entities

- **Translation Request**: Input = completed summary text + target language;
  Output = translated summary text. Generated via a separate LLM call with a
  translation-specific system prompt.
- **Knowledge Note**: The output Markdown file containing: video link, Summary,
  Translation (conditional), Transcript. The note is the final artifact persisted
  to the Obsidian vault.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users with a target language configured see a Translation section in
  100% of successfully generated knowledge notes (when target language ≠ source
  language).
- **SC-002**: Translation generation adds no more than 50% to the total note
  creation time compared to summary-only generation (i.e., the translation call
  should not double the wait time in typical cases).
- **SC-003**: When translation fails, 100% of the summary and transcript content
  is preserved (zero data loss from translation failures).
- **SC-004**: Users who have NOT configured a target language (or set it to
  "Auto") see zero change in behavior — no empty or irrelevant Translation
  sections appear.

## Assumptions

- The LLM used for translation is the same provider/model configured for summary
  generation. No separate translation provider configuration is needed for the MVP.
- The translation call uses a fixed, built-in system prompt optimized for
  translation (not the user's custom summary prompt).
- The source language detection uses the transcript's natural language and the
  user's configured `lang` setting as a heuristic, rather than running a separate
  language-detection step.
- The "Auto" setting for target language means "skip translation and let the
  summary be in whatever language the LLM outputs naturally."
- Translation timeout (60s) and error handling follow the same patterns already
  established by the streaming summary feature.
