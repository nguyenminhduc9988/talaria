/**
 * Resumable run-state store.
 *
 * State survives process boundaries so a pipeline interrupted mid-phase resumes
 * exactly where it stopped — the property that makes long autonomous runs safe.
 * Serialized as pretty JSON under `<root>/.talaria/state/<runId>.json`.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { RunState, Pipeline } from "./types.ts";

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export function stateDir(root: string): string {
  return join(root, ".talaria", "state");
}

function statePath(root: string, runId: string): string {
  return join(stateDir(root), `${runId}.json`);
}

/** Deterministic run id from pipeline + timestamp; no Math.random dependency. */
export function makeRunId(pipelineId: string, at: number): string {
  return `${pipelineId}-${at.toString(36)}`;
}

export function newRun(
  pipeline: Pipeline,
  root: string,
  clock: Clock = systemClock,
  stateRoot: string = root,
): RunState {
  const at = clock.now();
  const steps: RunState["steps"] = {};
  for (const phase of pipeline.phases) {
    for (const step of phase.steps) {
      steps[step.id] = { stepId: step.id, status: "pending", findings: [] };
    }
  }
  return {
    runId: makeRunId(pipeline.id, at),
    pipelineId: pipeline.id,
    root,
    stateRoot,
    createdAt: at,
    updatedAt: at,
    steps,
    status: "active",
  };
}

export function saveRun(state: RunState, clock: Clock = systemClock): void {
  state.updatedAt = clock.now();
  const p = statePath(state.stateRoot, state.runId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2));
}

export function loadRun(root: string, runId: string): RunState | null {
  const p = statePath(root, runId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as RunState;
}

/** Most recent run for a root, if any — used by `talaria resume`. */
export function latestRun(root: string): RunState | null {
  const dir = stateDir(root);
  if (!existsSync(dir)) return null;
  const runs = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadRun(root, f.replace(/\.json$/, "")))
    .filter((r): r is RunState => r !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return runs[0] ?? null;
}
