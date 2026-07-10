# Roadmap

Talaria reimagines the agent-orchestration surface as **typed, in-tree modules**.
This tracks the port honestly: what ships today, and what's queued. Nothing here
is marked done until it has code **and** tests in this repo.

## Shipping now (v0.1.0)

| Module | Detectors | Agents | Gate | Tests |
|--------|-----------|--------|------|-------|
| `site-boost` | `seo`, `slop` | `seo-editor` | error-level SEO | yes |
| `code-review` | — | `reviewer` | error-level correctness | yes |

Core engine, registry + boot validation, resumable state, glob, CLI, platform
detection — all shipping and tested (12 tests).

## Queued modules

Mapped from the capability surface Talaria set out to match and beat. Each becomes
a self-contained `src/modules/<id>.ts` with detectors/agents/pipelines + tests.

| Module | Purpose | Status |
|--------|---------|--------|
| `deslop` | Standalone slop cleanup pipeline (slop detector + editor + gate) | detector done; pipeline queued |
| `prepare-delivery` | Pre-ship gate chain: slop → review → docs-sync → gate | queued |
| `ship` | PR creation, CI watch, merge (agent + gh) | queued |
| `next-task` | Task selection → implement → PR → merge orchestrator | queued |
| `drift-detect` | Plan-vs-implementation drift detector | queued |
| `repo-intel` | Git history + AST symbol + metadata static analysis | queued |
| `perf` | Performance investigation pipeline | queued |
| `onboard` | Codebase onboarding guide generator | queued |
| `enhance` | Config/agent/skill/hook quality analyzers | queued |
| `learn` | Topic research → learning guide | queued |
| `consult` / `debate` | Cross-model consultation and structured debate | queued |
| `audit-project` | Multi-agent parallel code review | queued |

## New modules (beyond the prior art)

| Module | Purpose |
|--------|---------|
| `site-boost` | ✅ SEO + content quality for static sites (the traffic engine) |
| `link-health` | Broken internal/external links, orphan pages, sitemap drift | queued |
| `content-refresh` | Detect stale/thin content, propose expansions for ranking | queued |
| `serp-watch` | Track keyword rankings, feed gaps back into `content-refresh` | queued |

## Adapters

| Target | Status |
|--------|--------|
| Hermes (native) | shipped — private deployment |
| Claude Code (`.claude/agents`, marketplace) | queued |
| Codex / OpenCode / Cursor / Kiro | queued |
