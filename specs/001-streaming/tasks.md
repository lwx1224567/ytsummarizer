# Tasks: Streaming Summary Output

**Input**: Design documents from `specs/001-streaming/`

## Phase 1: Core Interface & Implementation

- [ ] T001 [US1] Add `generateSummaryStream()` method to `LLMProvider` interface in `src/llm/types.ts`
- [ ] T002 [US1] Implement streaming logic in `src/llm/openai-compatible-provider.ts` (stream: true, for await, onChunk callback)
- [ ] T003 [US1] Implement non-streaming fallback on stream failure in `src/llm/openai-compatible-provider.ts`

## Phase 2: Wire into Main Flow

- [ ] T004 [US1] Modify `createNewPageWithTranscript()` in `src/main.ts` to use streaming with throttled vault.process()
- [ ] T005 [US1] Preserve partial text on error + add error marker in `src/main.ts`

## Phase 3: Tests

- [ ] T006 [US1] Jest tests for streaming success path in `src/llm/openai-compatible-provider.test.ts`
- [ ] T007 [US1] Jest tests for streaming error + fallback in `src/llm/openai-compatible-provider.test.ts`
- [ ] T008 [P] Fix stale references in `src/transcript-view.ts` (old openaiService API → new llmService)

## Phase 4: Manual Verification

- [ ] T009 Manual test with OpenAI provider
- [ ] T010 Manual test with Ollama provider
