<!--
  Sync Impact Report
  ===================
  Version change: 0.0.0 → 1.0.0 (initial ratification)
  Modified principles: N/A (initial creation)
  Added sections:
    - Core Principles (5 principles)
    - Technology Stack
    - Development Workflow
    - Governance
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ aligned (Constitution Check gate references this file)
    - .specify/templates/spec-template.md ✅ aligned (user stories + acceptance criteria pattern matches)
    - .specify/templates/tasks-template.md ✅ aligned (test-first pattern matches Principle 5)
  Follow-up TODOs: None
-->

# YTSummarizer Constitution

## Core Principles

### I. MVP First

Every feature MUST start with the smallest viable change that delivers user value.
Scope MUST be strictly limited to the files identified in the feature plan — no
refactoring unrelated code, no introducing new abstractions "just in case."
Complexity (map-reduce pipelines, new dependencies, new interfaces) MUST be
justified in the implementation plan before coding begins.

**Rationale**: The plugin is a focused tool. Over-engineering increases
maintenance burden and review time without proportional user benefit.

### II. Native Obsidian API Only

All UI MUST use Obsidian's built-in DOM APIs (e.g., `createEl`, `Setting`,
`Notice`, `ItemView`). Do NOT introduce React, Vue, Svelte, or any other UI
framework. Styling MUST use the existing `styles.css` patterns and Obsidian CSS
variables for theme compatibility.

**Rationale**: Framework dependencies bloat the plugin, conflict with Obsidian's
render cycle, and break when Obsidian updates its DOM structure. The current
codebase already follows this pattern — maintain it.

### III. Dependency Discipline

New npm dependencies MUST be explicitly justified in the implementation plan.
Prefer reusing capabilities already in the dependency tree — specifically the
`openai` npm package (v4.x), which provides streaming, token counting, and
multi-model support. Do NOT add tokenizer libraries (e.g., `tiktoken`) when a
simple character-count heuristic suffices for the MVP.

**Rationale**: Each dependency is a supply-chain risk and a potential version
conflict with Obsidian's runtime. The `openai` SDK alone already covers the
majority of LLM integration needs.

### IV. Error Resilience

Every LLM call MUST have a graceful degradation path. If the API fails, times
out, or returns malformed data, the plugin MUST write a "Failed to ..." message
into the user's note rather than leaving it blank or throwing an unhandled
exception. Partial results (e.g., streamed text already written before a
connection drop) MUST be preserved, not discarded.

**Rationale**: Users trust the plugin with their notes. Silent failures or lost
content erode that trust. The existing codebase already follows this pattern
(`Failed to generate summary.`) — all new LLM features must maintain it.

### V. Test Coverage for Features

Every new feature MUST include Jest unit tests in a `*.test.ts` file co-located
with the source it tests (under `src/`). Tests MUST cover: the happy path, the
primary error path, and at least one boundary condition. Use Jest's built-in
mocking (no additional mocking frameworks) to isolate LLM calls from real API
requests.

**Rationale**: LLM integrations have many failure modes (network, auth, rate
limits, malformed responses). Tests are the only way to iterate on these
features without repeatedly hitting real APIs.

## Technology Stack

- **Language**: TypeScript 4.7+
- **Bundler**: esbuild (via `esbuild.config.mjs`)
- **Runtime**: Obsidian plugin API (Node.js 16+ target)
- **LLM SDK**: `openai` npm package v4.x (OpenAI-compatible protocol)
- **HTML Parsing**: `node-html-parser` v6.x (for YouTube transcript scraping)
- **Testing**: Jest 29 + ts-jest
- **Package Manager**: npm (lockfile committed)

## Development Workflow

1. **Branch per feature**: Each feature gets its own Git branch (e.g.,
   `feat/streaming`, `feat/segmented-summary`, `feat/translation`). Merge to
   `main` only after tests pass and manual verification succeeds.
2. **Spec-first**: Use spec-kit (`/speckit-specify → /speckit-plan →
   /speckit-tasks → /speckit-implement`) for each feature. The spec documents
   serve as the reviewable design artifact before code is written.
3. **Manual verification required**: Jest tests alone are not sufficient. Each
   feature MUST be manually tested in Obsidian with at least one real LLM
   provider before merging.
4. **Commit granularity**: Commits should map to task completion. Avoid "mega
   commits" that bundle multiple unrelated changes.
5. **TypeScript strict mode**: The `tsconfig.json` `strict: true` setting is
   non-negotiable. Code that does not type-check must not be committed.

## Governance

This constitution supersedes all other project practices documents. Amendments
require:

1. A documented rationale (why the change is needed)
2. Review against all existing features for consistency
3. A version bump following semantic versioning (MAJOR for principle
   removal/redefinition, MINOR for new principles or sections, PATCH for
   clarifications).

All feature plans (`/speckit-plan` output) MUST include a "Constitution Check"
section verifying compliance with each principle before implementation begins.
Violations that are deemed necessary MUST be documented in the plan's
"Complexity Tracking" table with a clear explanation of why a simpler
alternative was rejected.

**Version**: 1.0.0 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-07
