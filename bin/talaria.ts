#!/usr/bin/env -S npx tsx
/**
 * Talaria CLI.
 *
 *   talaria list                       list modules / pipelines / detectors
 *   talaria scan <root> [--json]       run site-boost over a directory
 *   talaria run <pipeline> --root <d>  run any pipeline
 *   talaria resume --root <dir>        resume the latest run for a root
 *   talaria report --root <dir>        print findings from the latest run
 *
 * Exit code is non-zero when a run ends `blocked` (a gate failed) — CI-friendly.
 */

import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { bootRegistry } from "../src/index.ts";
import { runPipeline } from "../src/core/pipeline.ts";
import { createLogger } from "../src/core/logger.ts";
import { latestRun } from "../src/core/state.ts";
import { detectPlatform } from "../src/core/platform.ts";
import type { RunState, Finding } from "../src/core/types.ts";

function arg(flags: string[], name: string): string | undefined {
  const i = flags.indexOf(name);
  return i >= 0 ? flags[i + 1] : undefined;
}

function printFindings(state: RunState): void {
  const all: Finding[] = Object.values(state.steps).flatMap((s) => s.findings);
  const bySev = new Map<string, number>();
  for (const f of all) bySev.set(f.severity, (bySev.get(f.severity) ?? 0) + 1);
  for (const f of all.slice(0, 200)) {
    const loc = f.file ? `${f.file}:${f.line ?? 0}` : "";
    process.stdout.write(`[${f.severity.toUpperCase()}] ${f.rule}  ${loc}\n    ${f.message}\n`);
  }
  const summary = [...bySev.entries()].map(([s, n]) => `${n} ${s}`).join(", ") || "clean";
  process.stdout.write(`\n${all.length} finding(s): ${summary}\n`);
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  const reg = bootRegistry();
  const log = createLogger({ level: (arg(rest, "--log") as any) ?? "info" });

  switch (cmd) {
    case "list": {
      process.stdout.write(`platform: ${detectPlatform()}\n\nModules:\n`);
      for (const m of reg.listModules()) process.stdout.write(`  ${m.id} — ${m.description}\n`);
      process.stdout.write(`\nPipelines:\n`);
      for (const p of reg.listPipelines()) process.stdout.write(`  ${p.id} — ${p.title}\n`);
      process.stdout.write(`\nDetectors:\n`);
      for (const d of reg.listDetectors()) process.stdout.write(`  ${d.id} — ${d.title}\n`);
      return 0;
    }

    case "scan":
    case "run": {
      const pipelineId = cmd === "scan" ? "site-boost" : rest[0];
      const root = resolve(cmd === "scan" ? (rest[0] ?? ".") : (arg(rest, "--root") ?? "."));
      if (!pipelineId) {
        process.stderr.write("usage: talaria run <pipeline> --root <dir>\n");
        return 2;
      }
      const stateRoot = resolve(arg(rest, "--state") ?? homedir());
      const state = await runPipeline(reg.pipeline(pipelineId), { root, registry: reg, logger: log, stateRoot });
      if (arg(rest, "--json") === undefined) printFindings(state);
      else process.stdout.write(JSON.stringify(state, null, 2) + "\n");
      return state.status === "blocked" ? 1 : 0;
    }

    case "resume": {
      const stateRoot = resolve(arg(rest, "--state") ?? homedir());
      const prev = latestRun(stateRoot);
      if (!prev) {
        process.stderr.write(`no prior run under ${stateRoot}\n`);
        return 2;
      }
      const state = await runPipeline(reg.pipeline(prev.pipelineId), {
        root: prev.root,
        registry: reg,
        logger: log,
        stateRoot,
        resume: prev,
      });
      printFindings(state);
      return state.status === "blocked" ? 1 : 0;
    }

    case "report": {
      const stateRoot = resolve(arg(rest, "--state") ?? homedir());
      const prev = latestRun(stateRoot);
      if (!prev) {
        process.stderr.write(`no run found under ${stateRoot}\n`);
        return 2;
      }
      printFindings(prev);
      return 0;
    }

    default:
      process.stdout.write(
        "talaria <list|scan|run|resume|report>\n" +
          "  scan <root>            SEO+slop scan of a site directory\n" +
          "  run <pipeline> --root  run a named pipeline\n" +
          "  resume --root <dir>    resume the latest run\n" +
          "  report --root <dir>    print latest findings\n",
      );
      return cmd ? 2 : 0;
  }
}

main().then((code) => process.exit(code)).catch((err) => {
  process.stderr.write(`[ERROR] ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
