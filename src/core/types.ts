/**
 * Talaria core type model.
 *
 * Design note (vs. the untyped-CommonJS prior art this improves on):
 * every orchestration primitive is a typed, discriminated value. The runtime
 * distinguishes deterministic work (`check` steps run by code) from model work
 * (`agent` steps) at the type level, so "code does code-work, AI does AI-work"
 * is enforced by the compiler rather than convention.
 */

export type Severity = "info" | "warn" | "error" | "critical";

export const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

/** A single machine- or model-detected issue with a stable identity. */
export interface Finding {
  /** Stable key: `${detector}:${file}:${line}:${rule}` — used for dedupe. */
  readonly id: string;
  readonly detector: string;
  readonly rule: string;
  readonly severity: Severity;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  /** Optional machine-applicable fix (unified text replacement). */
  readonly fix?: { readonly find: string; readonly replace: string };
  /** Free-form structured evidence for downstream agents. */
  readonly data?: Readonly<Record<string, unknown>>;
}

/** Input a detector operates on. Content is pre-read so detectors stay pure. */
export interface DetectInput {
  readonly file: string;
  readonly content: string;
  /** Detected language/kind, e.g. "html", "python", "markdown". */
  readonly kind: string;
}

/**
 * A deterministic analyzer. Pure: same input -> same findings, no I/O, no tokens.
 * This is the unit the runtime parallelizes and caches.
 */
export interface Detector {
  readonly id: string;
  readonly title: string;
  /** File-kind gate; cheap pre-filter before `detect` runs. */
  applies(input: Pick<DetectInput, "file" | "kind">): boolean;
  detect(input: DetectInput): Finding[];
}

/** Declarative agent definition, exported to each target platform's format. */
export interface AgentSpec {
  readonly name: string;
  readonly role: string;
  /** Model tier hint; adapters map this to concrete platform models. */
  readonly model: "haiku" | "sonnet" | "opus" | "fable" | "inherit";
  readonly description: string;
  /** Prompt body (platform-agnostic markdown). */
  readonly instructions: string;
  readonly tools?: readonly string[];
}

/* ----------------------------- Pipeline model ----------------------------- */

/** Deterministic step: runs a set of detectors over a file glob. */
export interface CheckStep {
  readonly kind: "check";
  readonly id: string;
  readonly detectors: readonly string[];
  /** Minimatch-style globs relative to the run root. */
  readonly include: readonly string[];
  readonly exclude?: readonly string[];
}

/** Model step: hands accumulated findings/context to an agent. */
export interface AgentStep {
  readonly kind: "agent";
  readonly id: string;
  readonly agent: string;
  /** Which prior findings to surface to the agent (by detector id, or "*"). */
  readonly consumes?: readonly string[];
}

/** Gate step: asserts a condition on run state; blocks the phase if it fails. */
export interface GateStep {
  readonly kind: "gate";
  readonly id: string;
  /** Fails the gate if any finding at/above this severity remains open. */
  readonly maxSeverity: Severity;
  /** Human-readable reason surfaced when the gate blocks. */
  readonly reason: string;
}

export type Step = CheckStep | AgentStep | GateStep;

/** A phase groups steps; it cannot start until `entryGate` (if any) passes. */
export interface Phase {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly Step[];
}

export interface Pipeline {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly phases: readonly Phase[];
}

/** A self-contained capability bundle. No external repo fetching — in-tree. */
export interface Module {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly detectors?: readonly Detector[];
  readonly agents?: readonly AgentSpec[];
  readonly pipelines?: readonly Pipeline[];
}

/* ------------------------------- Run state ------------------------------- */

export type StepStatus = "pending" | "running" | "passed" | "blocked" | "skipped";

export interface StepResult {
  readonly stepId: string;
  status: StepStatus;
  findings: Finding[];
  /** Epoch ms; injected by the runner so the core stays deterministic. */
  startedAt?: number;
  endedAt?: number;
  note?: string;
}

export interface RunState {
  readonly runId: string;
  readonly pipelineId: string;
  /** Directory the pipeline scans. */
  readonly root: string;
  /** Where state JSON is persisted; defaults to `root`. Keeps deploy dirs clean. */
  readonly stateRoot: string;
  createdAt: number;
  updatedAt: number;
  /** Per-step results keyed by stepId; resumable across process boundaries. */
  steps: Record<string, StepResult>;
  /** Terminal state of the whole run. */
  status: "active" | "completed" | "blocked";
}
