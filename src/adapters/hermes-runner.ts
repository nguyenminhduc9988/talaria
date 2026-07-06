/**
 * Hermes AgentRunner — executes `agent` steps by delegating to the local
 * `claude` CLI subprocess that the Hermes runtime already relies on.
 *
 * Superior remediation contract: after the agent edits files, the runner
 * RE-SCANS the tree with the same deterministic detectors and returns the
 * findings that actually remain. The gate therefore reflects filesystem truth,
 * not the model's (possibly optimistic) self-report.
 */

import { execFile } from "node:child_process";
import type { AgentRunner, AgentContext, AgentOutcome } from "../core/pipeline.ts";
import type { Detector, Finding } from "../core/types.ts";
import { scanFiles } from "../core/scan.ts";

export interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type SpawnFn = (
  cmd: string,
  args: readonly string[],
  cwd: string,
) => Promise<SpawnResult>;

export interface HermesRunnerOptions {
  /** Detectors used to re-scan and verify the agent's edits. */
  readonly detectors: readonly Detector[];
  readonly include: readonly string[];
  readonly exclude?: readonly string[];
  /** Model id for the subprocess. Defaults to the runtime's configured model. */
  readonly model?: string;
  /** CLI binary; defaults to "claude". */
  readonly bin?: string;
  /** Extra CLI args (e.g. permission flags). */
  readonly extraArgs?: readonly string[];
  /** Injected for tests; defaults to a real `execFile` spawn. */
  readonly spawn?: SpawnFn;
}

const defaultSpawn: SpawnFn = (cmd, args, cwd) =>
  new Promise((resolve) => {
    execFile(cmd, [...args], { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        code: err && typeof (err as { code?: number }).code === "number" ? (err as { code: number }).code : err ? 1 : 0,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
      });
    });
  });

export function buildPrompt(ctx: AgentContext): string {
  const lines = ctx.findings
    .slice(0, 400)
    .map((f) => `- [${f.severity}] ${f.rule} @ ${f.file ?? "?"}:${f.line ?? 0} — ${f.message}`);
  return [
    ctx.spec.instructions.trim(),
    "",
    `Working directory: ${ctx.root}`,
    `You are the "${ctx.spec.name}" agent (${ctx.spec.role}).`,
    "",
    `Resolve these ${ctx.findings.length} finding(s) by editing the source files in place:`,
    ...lines,
    "",
    "Apply the smallest correct edit per finding. Do not fabricate content.",
    "When done, stop. A deterministic re-scan will verify your work.",
  ].join("\n");
}

export function createHermesRunner(opts: HermesRunnerOptions): AgentRunner {
  const spawn = opts.spawn ?? defaultSpawn;
  const bin = opts.bin ?? "claude";

  return {
    async run(ctx: AgentContext): Promise<AgentOutcome> {
      if (ctx.findings.length === 0) return { findings: [], note: "nothing to fix" };

      const prompt = buildPrompt(ctx);
      const args = [
        "-p",
        prompt,
        ...(opts.model ? ["--model", opts.model] : []),
        ...(opts.extraArgs ?? []),
      ];
      const res = await spawn(bin, args, ctx.root);

      // Verify by deterministic re-scan — this is the source of truth.
      const remaining: Finding[] = scanFiles(ctx.root, opts.detectors, {
        include: opts.include,
        exclude: opts.exclude ?? [],
      });
      // Only report back findings the agent was asked to handle (its detectors).
      const consumedDetectors = new Set(ctx.findings.map((f) => f.detector));
      const open = remaining.filter((f) => consumedDetectors.has(f.detector));

      const note =
        res.code === 0
          ? `agent ran; ${ctx.findings.length}->${open.length} open after re-scan`
          : `agent exited ${res.code}; ${open.length} open after re-scan; stderr: ${res.stderr.slice(0, 200)}`;
      return { findings: open, note };
    },
  };
}
