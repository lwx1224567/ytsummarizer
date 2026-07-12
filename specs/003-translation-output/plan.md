# Implementation Plan: Translation Output in Knowledge Notes

**Branch**: `feat/translation` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-translation-output/spec.md`

## Summary

Add a `translateText()` method to the `LLMProvider` interface and implement it in
`OpenAICompatibleProvider`. Wire it into `createNewPageWithTranscript()` so that
when a target language is configured (≠ "Auto"/"English"), a Translation section
is added to the knowledge note between Summary and Transcript.

The summary is generated in the source language, then a separate non-streaming
LLM call translates it using a built-in translation-optimized prompt. If
translation fails, the summary and transcript are preserved and the Translation
section displays an error marker.

## Technical Context

**Language/Version**: TypeScript 4.7 (strict mode)

**Primary Dependencies**: `openai` npm v4.28+ (for translation LLM call), Obsidian
API (`vault.process()` for note writing), `node-html-parser` v6.x

**Storage**: Obsidian vault (Markdown files via `vault.process()`)

**Testing**: Jest 29 + ts-jest (mock OpenAI client for translation tests)

**Target Platform**: Obsidian Desktop (Electron/Node.js 16+)

**Project Type**: Obsidian plugin (single package)

**Performance Goals**: Translation adds ≤50% to total note creation time (typical
summary ~500-1000 tokens, translation call ~2-5 seconds)

**Constraints**: Non-streaming translation call (no debounced vault writes needed);
60s timeout; must preserve existing content on failure

**Scale/Scope**: ~4 files changed, ~80 lines new code, ~30 lines test code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MVP First | ✅ | Minimal change: one new method on existing interface, one new code path in main.ts. No settings UI changes needed (reuses `targetLanguage`). |
| II. Native Obsidian API | ✅ | Uses `vault.process()` for file writes, no UI framework. Translation section heading uses Obsidian-compatible Markdown. |
| III. Dependency Discipline | ✅ | No new dependencies. Reuses `openai` SDK for translation calls. No language-detection library added (heuristic-based skip logic). |
| IV. Error Resilience | ✅ | Translation failure preserves summary + transcript; writes "Translation failed: [reason]" marker. Empty summary skips translation. Follows existing error-handling patterns. |
| V. Test Coverage | ✅ | Jest tests for: translation success path, translation API failure, skip-when-Auto/English, skip-when-empty-summary, timeout handling. |

## Project Structure

### Documentation (this feature)

```text
specs/003-translation-output/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Architecture decisions
├── data-model.md        # Phase 1: Entities and state transitions
├── quickstart.md        # Phase 1: Validation scenarios
├── contracts/           # Phase 1: Interface contracts
│   └── llm-provider-interface.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── llm/
│   ├── types.ts                          # Add translateText() to LLMProvider interface
│   ├── openai-compatible-provider.ts     # Implement translateText() method
│   └── openai-compatible-provider.test.ts # Add translation test cases (expand existing)
└── main.ts                              # Wire translation into createNewPageWithTranscript()
```

**Structure Decision**: Single project layout — all changes are in the existing
`src/` tree. The feature adds one method to the LLM provider layer and one code
path in the plugin main file. No new source files needed.

## Complexity Tracking

> No violations — all five constitution principles pass.
