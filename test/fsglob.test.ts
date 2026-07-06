import { test } from "node:test";
import assert from "node:assert/strict";
import { globToRegExp, matchesAny } from "../src/core/fsglob.ts";

test("globToRegExp: ** spans directories, * stays in a segment", () => {
  assert.ok(globToRegExp("**/*.html").test("a/b/c.html"));
  assert.ok(globToRegExp("**/*.html").test("c.html"));
  assert.ok(!globToRegExp("*.html").test("a/b.html"));
  assert.ok(globToRegExp("*.html").test("b.html"));
});

test("globToRegExp: dots are literal, not wildcards", () => {
  assert.ok(!globToRegExp("*.html").test("xhtml"));
  assert.ok(globToRegExp("*.md").test("readme.md"));
});

test("matchesAny: OR across patterns", () => {
  assert.ok(matchesAny("docs/x.md", ["**/*.html", "**/*.md"]));
  assert.ok(!matchesAny("docs/x.txt", ["**/*.html", "**/*.md"]));
});
