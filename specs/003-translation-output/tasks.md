# Tasks: Translation Output in Knowledge Notes

**Input**: Design documents from `specs/003-translation-output/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included per Constitution Principle V (Test Coverage for Features).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing project is in working state

- [x] T001 Verify baseline: run `npx tsc --noEmit --skipLibCheck` and `npm test`, confirm 33 tests pass with zero type errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Interface change that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add `translateText(text: string, targetLanguage: string): Promise<string>` method to `LLMProvider` interface in `src/llm/types.ts`, with JSDoc specifying: non-streaming, uses fixed translation prompt, throws on failure

**Checkpoint**: Interface ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Generate Knowledge Note with Translation (Priority: P1) 🎯 MVP

**Goal**: When a user creates a knowledge note with a target translation language configured (≠ "Auto"/"English"), the note contains both the original-language summary and a translated version in a `## Translation` section between Summary and Transcript.

**Independent Test**: Set target language to "Chinese", create a new page from an English YouTube video, verify the note has: `## Summary` (English) → `## 中文翻译 (Chinese Translation)` (Chinese) → `## Transcript`.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [P] [US1] Write test: `translateText()` returns translated text on success in `src/llm/openai-compatible-provider.test.ts`
- [x] T004 [P] [US1] Write test: `translateText()` throws descriptive error on API failure in `src/llm/openai-compatible-provider.test.ts`
- [x] T005 [P] [US1] Write test: `createNewPageWithTranscript()` includes Translation section when `targetLanguage` ≠ "Auto"/"English" in a new or existing test file for `src/main.ts`

### Implementation for User Story 1

- [x] T006 [US1] Implement `translateText()` method in `src/llm/openai-compatible-provider.ts` — non-streaming call with fixed translation system prompt, 60s timeout, preserves Markdown formatting (depends on T002)
- [x] T007 [US1] Wire translation into `createNewPageWithTranscript()` in `src/main.ts`: after summary generation, if `targetLanguage` ≠ "Auto" and ≠ "English", call `translateText()` with the summary and insert `## {Language}翻译 (Translation)` section between Summary and Transcript (depends on T006)
- [x] T008 [US1] Add translation skip logic: skip translation when summary is empty or target language is "Auto"/"English" in `src/main.ts`

**Checkpoint**: Basic translation works — English video → bilingual note (English summary + Chinese translation)

---

## Phase 4: User Story 2 - Translation with Segmented Summaries (Priority: P2)

**Goal**: For long transcripts that trigger map-reduce summarization, translation operates on the final merged summary, producing a single coherent translated section.

**Independent Test**: Use a long transcript with low threshold, verify that after segmented summarization, the Translation section contains a translation of the merged summary (not per-chunk translations).

### Tests for User Story 2

- [x] T009 [P] [US2] Write test: `createNewPageWithTranscript()` translates merged summary (not individual chunks) when segmented path is used in test file for `src/main.ts`

### Implementation for User Story 2

- [x] T010 [US2] In `createNewPageWithTranscript()` in `src/main.ts`, ensure translation is called with `result.mergedSummary` from the segmented path (the merged summary already exists after the reduce phase — verify it is passed to `translateText()`)

**Checkpoint**: Long transcripts produce a single coherent Translation section from the merged summary

---

## Phase 5: User Story 3 - Translation Error Resilience (Priority: P3)

**Goal**: When the translation LLM call fails (network error, API error, timeout), the note still contains the Summary and Transcript sections intact, with a clear error marker in the Translation section.

**Independent Test**: Use an invalid API key, create a new page, verify the note has: `## Summary` (content intact) → `## 中文翻译 (Chinese Translation)` (error: "Translation failed: ...") → `## Transcript` (content intact).

### Tests for User Story 3

- [x] T011 [P] [US3] Write test: translation failure preserves summary and transcript sections in note output in test file for `src/main.ts`
- [x] T012 [P] [US3] Write test: translation timeout produces descriptive error marker (60s timeout) in test file for `src/main.ts`

### Implementation for User Story 3

- [x] T013 [US3] Add try-catch around `translateText()` call in `createNewPageWithTranscript()` in `src/main.ts`: on failure, write `"Translation failed: {message}"` into the Translation section instead of translated content, while preserving Summary and Transcript
- [x] T014 [US3] Ensure `translateText()` enforces 60s timeout with `Promise.race` (same pattern as streaming summary timeout) in `src/llm/openai-compatible-provider.ts`

**Checkpoint**: Translation failures never cause data loss — summary and transcript always survive

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T015 Run `npx tsc --noEmit --skipLibCheck` and `npm test` — all tests pass, zero type errors
- [x] T016 Run quickstart.md manual validation: VS-1 (basic translation), VS-2 (skip when Auto/English), VS-3 (segmented path), VS-4 (failure resilience), VS-5 (empty summary edge case)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify baseline immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — interface change that BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core implementation. Tests (T003-T005) can run in parallel BEFORE implementation (T006-T008)
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — extends the same code path with segmented-specific logic
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — adds error handling around the translation call
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 — builds on same `createNewPageWithTranscript()` code
- **User Story 3 (P3)**: Can start after US1 — wraps the translation call from US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- In US1: T002 (interface) → T006 (translateText impl) → T007 (wire into main)
- T003, T004, T005 (US1 tests) can all run in parallel

### Parallel Opportunities

```
Phase 3 (US1) — Launch tests in parallel:
  T003: translateText success test
  T004: translateText failure test
  T005: note translation section test

Phase 4+5 (US2+US3) — Tests can launch in parallel:
  T009: segmented translation test
  T011: failure preserves content test
  T012: timeout test
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Verify baseline (T001)
2. Complete Phase 2: Add interface method (T002)
3. Complete Phase 3: US1 tests + implementation (T003-T008)
4. **STOP and VALIDATE**: Run `npm test` and manually test with a real YouTube video
5. At this point, the core translation feature WORKS

### Incremental Delivery

1. MVP (US1): Basic bilingual notes — deployable and useful
2. +US2: Works with long transcripts — covers all video lengths
3. +US3: Error-proof — no data loss from translation failures
4. Polish: Final verification

### Single Developer Strategy

Execute tasks in order: T001 → T002 → T003-T005 (parallel) → T006 → T007 → T008 → T009 → T010 → T011-T012 (parallel) → T013 → T014 → T015 → T016

---

## Notes

- [P] tasks = different files or independent test blocks, no dependencies
- [Story] label maps task to specific user story for traceability
- All user stories for this feature touch the same 2-3 source files — [P] markers apply primarily to test tasks
- Commit after each phase checkpoint
- The `translateText()` method uses the SAME provider/model/apiKey as summary generation (no new settings needed)
- Translation skip logic: `targetLanguage === "Auto" || targetLanguage === "English"` → no translation section
