import { test } from "node:test";
import assert from "node:assert/strict";
import { seoDetector } from "../src/detect/detectors/seo.ts";
import { slopDetector } from "../src/detect/detectors/slop.ts";

const rules = (fs: { rule: string }[]) => new Set(fs.map((f) => f.rule));

test("seo: flags a bare HTML document", () => {
  const html = `<!doctype html><html><head></head><body><img src="a.png"></body></html>`;
  const f = seoDetector.detect({ file: "a.html", content: html, kind: "html" });
  const r = rules(f);
  assert.ok(r.has("missing-title"));
  assert.ok(r.has("missing-meta-description"));
  assert.ok(r.has("missing-viewport"));
  assert.ok(r.has("no-h1"));
  assert.ok(r.has("img-missing-alt"));
  assert.ok(r.has("missing-json-ld"));
});

test("seo: a well-formed page passes the important checks", () => {
  const html = `<!doctype html><html lang="en"><head>
    <title>Short Title</title>
    <meta name="description" content="A concise, useful description of the page.">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="canonical" href="https://x.com/">
    <meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="i">
    <script type="application/ld+json">{}</script>
  </head><body><h1>One</h1>
    <img src="a.png" alt="descriptive" width="16" height="9" loading="lazy">
  </body></html>`;
  const f = seoDetector.detect({ file: "b.html", content: html, kind: "html" });
  const errors = f.filter((x) => x.severity === "error");
  assert.deepEqual(errors, [], `unexpected errors: ${JSON.stringify(errors)}`);
});

test("seo: only applies to html", () => {
  assert.equal(seoDetector.applies({ file: "x.md", kind: "markdown" }), false);
  assert.equal(seoDetector.applies({ file: "x.html", kind: "html" }), true);
});

test("slop: detects multiple cliches with line numbers", () => {
  const md = `Intro line.\nIt's important to note that we delve into the rich tapestry.\nIn conclusion, unlock your potential.`;
  const f = slopDetector.detect({ file: "p.md", content: md, kind: "markdown" });
  const r = rules(f);
  assert.ok(r.has("important-to-note"));
  assert.ok(r.has("delve"));
  assert.ok(r.has("tapestry"));
  assert.ok(r.has("in-conclusion"));
  assert.ok(r.has("unleash-unlock"));
  const noteHit = f.find((x) => x.rule === "important-to-note");
  assert.equal(noteHit?.line, 2);
  assert.equal(noteHit?.fix?.replace, "");
});

test("slop: clean prose yields nothing", () => {
  const f = slopDetector.detect({ file: "c.md", content: "The API returns a token. Cache it.", kind: "markdown" });
  assert.deepEqual(f, []);
});
