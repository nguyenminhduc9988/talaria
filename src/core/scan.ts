/** Shared file-scan: run a set of detectors over a glob. Used by the pipeline
 * `check` step and by agent runners that verify their own edits by re-scanning. */

import { readFileSync } from "node:fs";
import type { Detector, Finding } from "./types.ts";
import { listFiles } from "./fsglob.ts";
import { fileKind } from "./kind.ts";

export interface ScanOptions {
  include: readonly string[];
  exclude?: readonly string[];
  readFile?: (path: string) => string;
}

export function scanFiles(
  root: string,
  detectors: readonly Detector[],
  opts: ScanOptions,
): Finding[] {
  const read = opts.readFile ?? ((p: string) => readFileSync(p, "utf8"));
  const files = listFiles(root, opts.include, opts.exclude ?? []);
  const out: Finding[] = [];
  for (const file of files) {
    const kind = fileKind(file);
    const relevant = detectors.filter((d) => d.applies({ file, kind }));
    if (relevant.length === 0) continue;
    let content: string;
    try {
      content = read(file);
    } catch {
      continue;
    }
    for (const d of relevant) out.push(...d.detect({ file, content, kind }));
  }
  return out;
}
