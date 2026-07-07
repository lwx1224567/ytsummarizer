# Implementation Plan: Streaming Summary Output

**Branch**: `feat/streaming` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-streaming/spec.md`

## Summary

Add a `generateSummaryStream()` method to the `LLMProvider` interface that
accepts an `onChunk` callback. Implement it in `OpenAICompatibleProvider` using
the OpenAI SDK's native `stream: true` + `for await` pattern. Wire it into
`createNewPageWithTranscript()` so summary text streams into the note file in
real time, with a non-streaming fallback on failure.

## Technical Context

**Language/Version**: TypeScript 4.7

**Primary Dependencies**: `openai` npm v4.28+ (native streaming via
`stream: true`), Obsidian API (`vault.process()`)

**Storage**: Obsidian vault (Markdown files via `vault.process()`)

**Testing**: Jest 29 + ts-jest (mock OpenAI client)

**Target Platform**: Obsidian Desktop (Electron/Node.js)

**Project Type**: Obsidian plugin (single package)

**Constraints**: `vault.process()` calls must be throttled (~500ms) to avoid
I/O contention; each call rewrites the entire file content.

**Scale/Scope**: ~4 files changed, ~100 lines new code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MVP First | ✅ | Minimal change: one new method on existing interface, one new code path in main.ts |
| II. Native Obsidian API | ✅ | Uses `vault.process()` (Obsidian API) for file updates, no UI framework |
| III. Dependency Discipline | ✅ | No new dependencies; uses `openai` SDK's built-in streaming |
| IV. Error Resilience | ✅ | Fallback to non-streaming on error; preserves partial text on interruption |
| V. Test Coverage | ✅ | Jest tests for streaming success, streaming error, fallback behavior |

## Project Structure

### Documentation (this feature)

```text
specs/001-streaming/
├── plan.md              # This file
├── spec.md              # Feature specification
└── tasks.md             # Task breakdown
```

### Source Code (repository root)

```text
src/
├── llm/
│   ├── types.ts                          # Add generateSummaryStream() to interface
│   ├── openai-compatible-provider.ts     # Implement streaming logic
│   └── openai-compatible-provider.test.ts # NEW: streaming tests
├── main.ts                              # Wire streaming into createNewPageWithTranscript()
└── transcript-view.ts                   # (out of scope - sidebar uses separate path)
```

## Design Decisions

### Approach: Callback-based streaming

```typescript
// LLMProvider interface addition
generateSummaryStream(
  transcript: string,
  title: string,
  url: string,
  onChunk: (chunk: string) => void,
): Promise<string>;  // resolves with full text on completion
```

**Why not EventEmitter/ Observable?** Callbacks are simple, have zero
dependencies, and match Obsidian's existing patterns.

### Throttling: Debounced vault.process()

Rather than calling `vault.process()` (which rewrites the entire file) on every
token, we accumulate chunks and flush every 500ms. This keeps the UI responsive
without excessive file I/O.

### Fallback: Try stream, catch → non-streaming

If `stream: true` fails (provider doesn't support it, or network error after
connection), we catch the error, keep any partial text already written, and
retry once with `stream: false`.

## Complexity Tracking

> No violations — all principles pass.
