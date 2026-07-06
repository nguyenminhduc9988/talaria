/**
 * The pipeline engine — Talaria's heart.
 *
 * Walks phases in order. Each step is one of three typed kinds:
 *   - check: run deterministic detectors over a file glob (no tokens)
 *   - agent: hand accumulated findings to an AI agent (injected runner)
 *   - gate:  block the run if unresolved findings exceed a severity threshold
 *
 * State is persisted after every step, so an interrupted run resumes at the
 * exact step it stopped on. Already-passed steps are skipped on resume.
 */

import { readFileSync } from "node:fs";
import type {
  Pipeline,
  RunState,
  Finding,
  Severity,
  AgentSpec,
} from "./types.ts";
import { SEVERITY_ORDER } from "./types.ts";
import type { Registry } from "./registry.ts";
import type { Logger } from "./logger.ts";
import { createLogger } from "./logger.ts";
import { type Clock, systemClock, newRun, saveRun } from "./state.ts";
import { scanFiles } from "./scan.ts";

/** Context an agent step receives. The runner decides how to execute it. */
export interface AgentContext {
  readonly spec: AgentSpec;
  readonly root: string;
  readonly findings: readonly Finding[];
}

export interface AgentOutcome {
  /** Findings the agent could not resolve (kept open for later gates). */
  readonly findings?: Finding[];
  readonly note?: string;
}

/** Injected execution backend for `agent` steps. Core has no LLM dependency. */
export interface AgentRunner {
  run(ctx: AgentContext): Promise<AgentOutcome>;
}

/**
 * Default runner: resolves nothing (dry planning mode). It echoes every consumed
 * finding back as still-open, so a gate downstream correctly blocks — "no runner
 * configured" must never be mistaken for "the agent fixed everything".
 */
export const noopRunner: AgentRunner = {
  async run(ctx) {
    return {
      findings: [...ctx.findings],
      note: `agent ${ctx.spec.name} not executed (no runner configured)`,
    };
  },
};

export interface RunOptions {
  readonly root: string;
  readonly registry: Registry;
  runner?: AgentRunner;
  logger?: Logger;
  clock?: Clock;
  /** Where to persist run state; defaults to `root`. Keeps deploy dirs clean. */
  stateRoot?: string;
  /** Resume this state instead of starting fresh. */
  resume?: RunState;
  /** Read file content (injectable for tests). */
  readFile?: (path: string) => string;
}

/**
 * Compute the set of still-open findings by replaying steps in pipeline order,
 * stopping before `beforeStepId` (exclusive). A `check` step adds its findings
 * to the ledger; an `agent` step removes the findings it consumed and re-adds
 * only the ones it reports as still open (plus any new ones it surfaced). This
 * is what lets an editor agent actually clear a gate.
 */
function computeOpen(
  state: RunState,
  pipeline: Pipeline,
  beforeStepId?: string,
): Finding[] {
  const open = new Map<string, Finding>();
  for (const phase of pipeline.phases) {
    for (const step of phase.steps) {
      if (step.id === beforeStepId) return [...open.values()];
      const res = state.steps[step.id];
      if (!res || (res.status !== "passed" && res.status !== "blocked")) continue;
      if (step.kind === "check") {
        for (const f of res.findings) open.set(f.id, f);
      } else if (step.kind === "agent") {
        for (const f of selectFindings([...open.values()], step.consumes)) {
          open.delete(f.id);
        }
        for (const f of res.findings) open.set(f.id, f);
      }
    }
  }
  return [...open.values()];
}

function worstSeverity(findings: readonly Finding[]): Severity | null {
  let worst: Severity | null = null;
  for (const f of findings) {
    if (worst === null || SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[worst]) {
      worst = f.severity;
    }
  }
  return worst;
}

export async function runPipeline(
  pipeline: Pipeline,
  opts: RunOptions,
): Promise<RunState> {
  const log = opts.logger ?? createLogger();
  const clock = opts.clock ?? systemClock;
  const runner = opts.runner ?? noopRunner;
  const read = opts.readFile ?? ((p: string) => readFileSync(p, "utf8"));
  const registry = opts.registry;

  const state = opts.resume ?? newRun(pipeline, opts.root, clock, opts.stateRoot ?? opts.root);
  log.info(`run ${state.runId}`, { pipeline: pipeline.id, resume: !!opts.resume });

  for (const phase of pipeline.phases) {
    log.info(`phase ${phase.id}: ${phase.title}`);
    for (const step of phase.steps) {
      const result = state.steps[step.id]!;
      if (result.status === "passed" || result.status === "skipped") {
        log.debug(`skip ${step.id} (${result.status})`);
        continue;
      }
      result.status = "running";
      result.startedAt = clock.now();
      saveRun(state, clock);

      if (step.kind === "check") {
        const detectors = step.detectors.map((id) => registry.detector(id));
        const found = scanFiles(opts.root, detectors, {
          include: step.include,
          exclude: step.exclude ?? [],
          readFile: read,
        });
        result.findings = dedupe(found);
        result.status = "passed";
        log.info(`check ${step.id}: ${result.findings.length} finding(s)`);
      } else if (step.kind === "agent") {
        const spec = registry.agent(step.agent);
        const consumable = selectFindings(computeOpen(state, pipeline, step.id), step.consumes);
        const outcome = await runner.run({ spec, root: opts.root, findings: consumable });
        result.findings = outcome.findings ?? [];
        result.note = outcome.note ?? "";
        result.status = "passed";
        log.info(`agent ${step.id} (${spec.name}): ${result.findings.length} open after run`);
      } else {
        // gate
        const open = computeOpen(state, pipeline, step.id).filter(
          (f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[step.maxSeverity],
        );
        if (open.length > 0) {
          result.status = "blocked";
          result.note = `${step.reason} (${open.length} finding(s) >= ${step.maxSeverity})`;
          result.endedAt = clock.now();
          state.status = "blocked";
          saveRun(state, clock);
          log.error(`gate ${step.id} BLOCKED: ${result.note}`, {
            worst: worstSeverity(open),
          });
          return state;
        }
        result.status = "passed";
        log.info(`gate ${step.id}: clear`);
      }

      result.endedAt = clock.now();
      saveRun(state, clock);
    }
  }

  state.status = "completed";
  saveRun(state, clock);
  log.info(`run ${state.runId} completed`);
  return state;
}

function selectFindings(
  all: readonly Finding[],
  consumes: readonly string[] | undefined,
): Finding[] {
  if (!consumes || consumes.includes("*")) return [...all];
  const want = new Set(consumes);
  return all.filter((f) => want.has(f.detector));
}

/** Dedupe by finding id, keeping the highest-severity instance. */
export function dedupe(findings: readonly Finding[]): Finding[] {
  const byId = new Map<string, Finding>();
  for (const f of findings) {
    const existing = byId.get(f.id);
    if (!existing || SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[existing.severity]) {
      byId.set(f.id, f);
    }
  }
  return [...byId.values()];
}
