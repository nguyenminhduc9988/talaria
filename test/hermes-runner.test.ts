import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHermesRunner, buildPrompt, type SpawnFn } from "../src/adapters/hermes-runner.ts";
import { seoDetector } from "../src/detect/detectors/seo.ts";
import { bootRegistry } from "../src/index.ts";
import { runPipeline } from "../src/core/pipeline.ts";
import { createLogger } from "../src/core/logger.ts";
import type { Clock } from "../src/core/state.ts";

const silent = createLogger({ level: "error" });
const clk = (): Clock => { let t = 0; return { now: () => (t += 1) }; };

const GOOD_HTML = `<!doctype html><html lang="en"><head>
<title>Good</title>
<meta name="description" content="Good description here.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://x/">
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="i">
<script type="application/ld+json">{}</script>
</head><body><h1>H</h1><img src="a.png" alt="x" width="1" height="1" loading="lazy"></body></html>`;

test("buildPrompt includes instructions and findings", () => {
  const p = buildPrompt({
    spec: { name: "seo-editor", role: "editor", model: "sonnet", description: "", instructions: "FIX IT" },
    root: "/tmp/site",
    findings: [{ id: "seo:i.html:1:no-h1", detector: "seo", rule: "no-h1", severity: "error", message: "No h1", file: "i.html", line: 1 }],
  });
  assert.match(p, /FIX IT/);
  assert.match(p, /no-h1/);
  assert.match(p, /\/tmp\/site/);
});

test("runner re-scans after the agent edits and reports real remaining findings", async () => {
  const dir = mkdtempSync(join(tmpdir(), "talaria-hr-"));
  try {
    const file = join(dir, "index.html");
    writeFileSync(file, "<html><body><p>bad</p></body></html>");

    // Fake claude subprocess: "fixes" the page by writing good HTML.
    const spawn: SpawnFn = async (_cmd, _args, cwd) => {
      writeFileSync(join(cwd, "index.html"), GOOD_HTML);
      return { code: 0, stdout: "done", stderr: "" };
    };

    const runner = createHermesRunner({ detectors: [seoDetector], include: ["**/*.html"], spawn });
    const outcome = await runner.run({
      spec: { name: "seo-editor", role: "editor", model: "sonnet", description: "", instructions: "fix" },
      root: dir,
      findings: seoDetector.detect({ file, content: readFileSync(file, "utf8"), kind: "html" }),
    });

    const errorsLeft = (outcome.findings ?? []).filter((f) => f.severity === "error");
    assert.deepEqual(errorsLeft, [], `agent edit should clear errors, got ${JSON.stringify(errorsLeft)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("end-to-end: site-boost pipeline passes its gate when the Hermes runner fixes the page", async () => {
  const dir = mkdtempSync(join(tmpdir(), "talaria-e2e-"));
  try {
    writeFileSync(join(dir, "index.html"), "<html><body><p>bad</p></body></html>");
    const spawn: SpawnFn = async (_c, _a, cwd) => {
      writeFileSync(join(cwd, "index.html"), GOOD_HTML);
      return { code: 0, stdout: "", stderr: "" };
    };
    const reg = bootRegistry();
    const runner = createHermesRunner({
      detectors: [seoDetector],
      include: ["**/*.html", "**/*.md"],
      spawn,
    });
    const state = await runPipeline(reg.pipeline("site-boost"), {
      root: dir, registry: reg, runner, logger: silent, clock: clk(), stateRoot: dir,
    });
    assert.equal(state.status, "completed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
