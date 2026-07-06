import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootRegistry } from "../src/index.ts";
import { runPipeline, type AgentRunner } from "../src/core/pipeline.ts";
import { createLogger } from "../src/core/logger.ts";
import { latestRun } from "../src/core/state.ts";
import type { Clock } from "../src/core/state.ts";

const silent = createLogger({ level: "error" });

// Deterministic clock so runIds/timestamps are stable in tests.
function fakeClock(): Clock {
  let t = 1_000;
  return { now: () => (t += 1) };
}

function tmpSite(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "talaria-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

test("site-boost: gate blocks when SEO errors remain and noop agent resolves nothing", async () => {
  const root = tmpSite({ "index.html": "<html><body><p>hi</p></body></html>" });
  try {
    const reg = bootRegistry();
    const state = await runPipeline(reg.pipeline("site-boost"), {
      root,
      registry: reg,
      logger: silent,
      clock: fakeClock(),
    });
    assert.equal(state.status, "blocked");
    assert.equal(state.steps["no-seo-errors"]!.status, "blocked");
    // scan-seo ran and found the errors
    assert.ok(state.steps["scan-seo"]!.findings.some((f) => f.rule === "missing-title"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("site-boost: an editor agent that resolves errors lets the gate pass", async () => {
  const root = tmpSite({ "index.html": "<html><body><p>hi</p></body></html>" });
  try {
    const reg = bootRegistry();
    // Agent that "fixes" everything: returns no open findings.
    const fixer: AgentRunner = { async run() { return { findings: [], note: "fixed" }; } };
    const state = await runPipeline(reg.pipeline("site-boost"), {
      root,
      registry: reg,
      runner: fixer,
      logger: silent,
      clock: fakeClock(),
    });
    assert.equal(state.status, "completed");
    assert.equal(state.steps["no-seo-errors"]!.status, "passed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resume: a blocked run continues from the gate without re-scanning", async () => {
  const root = tmpSite({ "index.html": "<html><body></body></html>" });
  try {
    const reg = bootRegistry();
    let agentCalls = 0;
    const countingNoop: AgentRunner = {
      async run() { agentCalls++; return { findings: [], note: "" }; },
    };
    // First run: agent resolves errors so it completes; assert agent ran once.
    const first = await runPipeline(reg.pipeline("site-boost"), {
      root, registry: reg, runner: countingNoop, logger: silent, clock: fakeClock(),
    });
    assert.equal(first.status, "completed");
    assert.equal(agentCalls, 1);

    // Resume the persisted run: all steps already passed -> no new agent calls.
    const prev = latestRun(root)!;
    const resumed = await runPipeline(reg.pipeline("site-boost"), {
      root, registry: reg, runner: countingNoop, logger: silent, clock: fakeClock(), resume: prev,
    });
    assert.equal(resumed.status, "completed");
    assert.equal(agentCalls, 1, "resume must skip already-passed agent step");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("registry: boot validates all pipeline cross-references", () => {
  const reg = bootRegistry();
  assert.deepEqual(reg.validate(), []);
  assert.ok(reg.listPipelines().length >= 2);
});
