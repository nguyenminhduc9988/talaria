# Talaria

**The agent runtime that ships.** AI writes code — Talaria does everything else: deterministic detection, phase-gated pipelines, resumable state, and specialized agents that compose into structured workflows.

> Named for Hermes' winged sandals. Built to move work from *written* to *shipped* — and, for content sites, from *published* to *ranking*.

[![CI](https://github.com/nguyenminhduc9988/talaria/actions/workflows/ci.yml/badge.svg)](https://github.com/nguyenminhduc9988/talaria/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-blue.svg)

---

## Why

Models can write code. The hard part is everything around it — deciding what to work on, checking it, gating it, shipping it, and (for content) making it discoverable. Talaria is a small, **fully-typed** runtime that orchestrates that work:

- **Code does code-work.** Deterministic detectors (regex/structure/AST) find issues with zero tokens.
- **AI does AI-work.** Agents receive only the findings that need judgment.
- **Gates make "done" mean something.** A phase cannot pass while findings above a severity threshold remain open.
- **State survives interruption.** Runs persist after every step and resume exactly where they stopped.

The whole system is **self-contained** — every capability lives in this repo. There is no runtime fetch of external plugin repositories; what you clone is what you run.

## Install

```bash
git clone https://github.com/nguyenminhduc9988/talaria
cd talaria && npm install
npm run talaria -- list
```

Runs on Node 20+ via [`tsx`](https://github.com/privatenumber/tsx) — no build step.

## Quickstart — boost a static site's SEO

```bash
# Deterministic SEO + AI-slop scan over a site directory
npm run talaria -- scan ./my-site

# Any pipeline, explicitly
npm run talaria -- run site-boost --root ./my-site --json

# Resume an interrupted run; print the last run's findings
npm run talaria -- resume
npm run talaria -- report
```

`scan` exits non-zero when a gate blocks — drop it straight into CI.

## Concepts

| Primitive | What it is |
|-----------|------------|
| **Detector** | Pure function `input → Finding[]`. Deterministic, cacheable, parallelizable. No I/O, no tokens. |
| **Finding** | A typed issue with a stable id, severity, location, and optional machine-applicable fix. |
| **Step** | `check` (run detectors), `agent` (hand findings to an AI agent), or `gate` (block on severity). |
| **Phase** | An ordered group of steps. |
| **Pipeline** | An ordered set of phases with resumable run-state. |
| **Module** | A self-contained bundle of detectors + agents + pipelines, registered in-process. |

The runtime has **no LLM dependency**: `agent` steps call an injected `AgentRunner`. Tests use a fake; the Hermes integration uses the live agent; CI uses the no-op (dry) runner.

## Built-in modules

| Module | Purpose |
|--------|---------|
| `site-boost` | Deterministic SEO + AI-slop detection over a site's HTML/markdown, agent remediation, gate on error-level SEO issues. **The traffic engine.** |
| `code-review` | Correctness-focused review of the working diff, gated before delivery. |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the modules being ported next.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Short version:

```
src/core/       typed model, registry, pipeline engine, state, logging, platform detect
src/detect/     deterministic detectors (seo, slop, …)
src/modules/    self-contained capability bundles
src/adapters/   export modules to other agent harnesses (roadmap)
bin/talaria.ts  CLI
```

## Prior art & credits

Talaria is an **independent, clean-room reimplementation** of the agent-orchestration pattern — deterministic detection + phase-gated, resumable agent pipelines. That pattern was notably popularized by [AgentSys](https://github.com/agent-sh/agentsys) (MIT, © Avi Fenesh), which this project studied and set out to improve on with a fully-typed core, in-tree self-contained modules (no marketplace fetch), and first-class resumable state. No AgentSys source is copied here. Credit where due.

## License

MIT © 2026 nguyenminhduc9988
