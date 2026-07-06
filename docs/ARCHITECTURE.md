# Talaria Architecture

Talaria separates **deterministic work** (code) from **judgment work** (agents) at the
type level, and threads both through a resumable, gated pipeline.

## Layers

```
                 ┌─────────────────────────────────────────────┐
   CLI / Hermes  │  bin/talaria.ts  ·  hermes skill driver      │
                 └───────────────┬─────────────────────────────┘
                                 │ runPipeline(pipeline, opts)
                 ┌───────────────▼─────────────────────────────┐
   Engine        │  core/pipeline.ts                            │
                 │   walk phases → steps → persist after each   │
                 │   check | agent | gate  (typed union)        │
                 └───┬──────────────┬───────────────┬───────────┘
                     │              │               │
        ┌────────────▼───┐  ┌───────▼────────┐  ┌───▼──────────────┐
        │ detect/        │  │ AgentRunner    │  │ core/state.ts    │
        │  detectors     │  │ (injected)     │  │  resumable JSON  │
        │  seo · slop    │  │ hermes|fake|noop│ │  ~/.talaria/state│
        └────────────────┘  └────────────────┘  └──────────────────┘
                     ▲
        ┌────────────┴───┐
        │ core/registry  │  modules register detectors/agents/pipelines
        │ + validate()   │  cross-references checked at boot, not mid-run
        └────────────────┘
```

## Key decisions (and how they improve on the prior art)

1. **Fully typed core.** Every primitive (`Finding`, `Step`, `Phase`, `Pipeline`,
   `Module`, `RunState`) is a strict TypeScript type with `noUncheckedIndexedAccess`
   and `exactOptionalPropertyTypes`. The `check`/`agent`/`gate` distinction is a
   discriminated union — "code does code-work, AI does AI-work" is compiler-enforced,
   not a convention. *(Prior art is untyped CommonJS.)*

2. **Self-contained modules, no marketplace fetch.** Modules live in `src/modules/`
   and register in-process. What you clone is what you run — no network dependency on
   external plugin repos at install or runtime. *(Prior art is a marketplace/installer
   that fetches ~24 plugin repos.)*

3. **Resumable state as a first-class property.** State is written after **every**
   step. `resume` replays only unfinished steps; already-passed `check`/`agent` steps
   are skipped, so nothing re-scans or re-spends tokens. State root is configurable so
   deploy directories stay clean.

4. **Findings ledger with real resolution semantics.** `computeOpen()` replays steps in
   order: a `check` adds findings; an `agent` removes the findings it *consumed* and
   re-adds only those still open; a `gate` reads the ledger. An agent that fixes issues
   genuinely clears the gate; a no-op agent leaves them open. This is the subtle logic
   that makes gated remediation correct.

5. **No LLM dependency in core.** `agent` steps call an injected `AgentRunner`. The core
   is unit-testable with a fake runner and runs in CI with the no-op runner.

## Data flow of a `site-boost` run

1. `scan-seo` / `scan-slop` (`check`) — detectors run over the HTML/markdown globs,
   emitting `Finding[]` with stable ids.
2. `apply-fixes` (`agent`) — the `seo-editor` agent receives the open findings, edits
   source files, and returns the findings it could not safely fix.
3. `no-seo-errors` (`gate`) — if any `error`+ finding remains open, the run ends
   `blocked` with a non-zero exit code; otherwise `completed`.

## Extending

- **New detector:** implement `Detector` in `src/detect/detectors/`, export it, add to a
  module's `detectors`.
- **New module:** create `src/modules/<id>.ts` exporting a `Module`, add it to
  `builtinModules`. `bootRegistry()` validates all cross-references at load.
- **New platform adapter:** emit a module's `AgentSpec[]` / pipelines into a target
  harness's format under `src/adapters/` (roadmap).
