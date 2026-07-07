# Feature Specification: Streaming Summary Output

**Feature Branch**: `feat/streaming`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "为 YTSummarizer 增加流式输出功能：LLM 生成摘要时，文字应逐段实时写入笔记文件，而不是等待完整响应后一次性写入。需要兼容现有 6 种 LLM 供应商配置。"

## User Scenarios & Testing

### User Story 1 - Real-time Summary Display (Priority: P1)

When a user generates a summary for a YouTube transcript, the text appears
incrementally (word-by-word or chunk-by-chunk) in the note file, rather than
appearing all at once after a long wait.

**Why this priority**: This is the core value proposition — reducing perceived
latency and giving users confidence that something is happening.

**Independent Test**: Generate a summary for any YouTube video; observe that
text appears progressively in the note before the generation completes.

**Acceptance Scenarios**:

1. **Given** a valid LLM configuration and a YouTube transcript, **When** the
   user triggers "Create new page" and the summary generation begins, **Then**
   text should appear in the note incrementally (chunks visible within 1-2
   seconds of the request starting).
2. **Given** an ongoing streaming summary generation, **When** the user scrolls
   through the note, **Then** they see the already-generated text plus a visible
   indicator that more content is coming.
3. **Given** a streaming summary that has partially completed, **When** a
   network error occurs, **Then** the already-streamed text is preserved and a
   "[Streaming interrupted: ...]" note is appended.

### User Story 2 - Provider Compatibility (Priority: P1)

All six LLM provider presets (OpenAI, DeepSeek, Zhipu GLM, Gemini, Ollama,
Custom OpenAI-compatible) support streaming.

**Why this priority**: The multi-provider architecture is a key feature;
streaming must not regress any provider.

**Independent Test**: Configure each provider and generate a summary; verify
text streams in for all of them.

**Acceptance Scenarios**:

1. **Given** OpenAI configured as provider, **When** summary generation runs,
   **Then** `stream: true` is passed and chunks are processed via `for await`.
2. **Given** Ollama configured as provider (local), **When** summary generation
   runs, **Then** streaming works (Ollama's OpenAI-compatible endpoint supports
   `stream: true`).
3. **Given** Zhipu GLM configured, **When** summary generation runs, **Then**
   streaming works (智谱 OpenAI-compatible endpoint supports streaming).

### Edge Cases

- What happens when `stream: true` is set but the provider does not support it?
  → Fall back to non-streaming mode with a notice to the user.
- What happens when the streaming connection is interrupted mid-response?
  → Preserve received text, append error marker, do NOT retry automatically.
- How does the streaming path interact with the sidebar TranscriptView?
  → Only the "Create new page" flow uses streaming (sidebar view is secondary;
  can be updated later).

## Requirements

### Functional Requirements

- **FR-001**: `LLMProvider` interface MUST expose a `generateSummaryStream()`
  method accepting an `onChunk` callback parameter.
- **FR-002**: `OpenAICompatibleProvider` MUST pass `stream: true` to the OpenAI
  SDK and iterate chunks with `for await (const chunk of stream)`.
- **FR-003**: `createNewPageWithTranscript()` MUST use the streaming method and
  call `vault.process()` on each chunk (or batched at ~500ms intervals to avoid
  excessive I/O).
- **FR-004**: The existing `generateSummary()` non-streaming method MUST remain
  as a fallback. If streaming fails, the code falls back to non-streaming
  automatically.
- **FR-005**: On streaming error, already-received text MUST be preserved and
  appended with an error marker.
- **FR-006**: All 6 provider presets MUST be validated for streaming
  compatibility (manual test checklist accepted).

### Key Entities

- **StreamChunk**: A partial text fragment from the LLM, accumulated into the
  note content.
- **onChunk callback**: `(chunkText: string, accumulatedText: string) => void`
  — invoked per chunk so callers can update the UI/file.

## Success Criteria

- **SC-001**: Text appears in the note within 2 seconds of starting summary
  generation (vs. 10-30 seconds for full response on long transcripts).
- **SC-002**: Zero regressions: existing tests pass, non-streaming fallback
  works for all providers.
- **SC-003**: Interrupted streams preserve received content (no blank notes).

## Assumptions

- All 6 provider presets use OpenAI-compatible endpoints that support
  `stream: true`. This is verified for OpenAI, DeepSeek, Zhipu, Gemini
  (OpenAI-compat layer), and Ollama.
- Throttling `vault.process()` calls to ~500ms intervals is acceptable for UX.
- The sidebar `TranscriptView` is out of scope for this feature (it uses a
  different code path that can be updated as a follow-up).
