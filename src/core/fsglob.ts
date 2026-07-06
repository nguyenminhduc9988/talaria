/**
 * Minimal zero-dependency glob. Supports `**` (any depth), `*` (within a
 * segment), and `?`. Enough for pipeline file selection without pulling a dep.
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".talaria",
  "dist",
  "coverage",
  "__pycache__",
]);

/** Convert a glob to an anchored regex over POSIX-style relative paths. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**` — any number of path segments (including zero)
        re += "(?:.*)";
        i++;
        if (glob[i + 1] === "/") i++; // swallow trailing slash of `**/`
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(relPath: string, globs: readonly string[]): boolean {
  const posix = relPath.split(sep).join("/");
  return globs.some((g) => globToRegExp(g).test(posix));
}

/** Recursively list files under `root` matching `include` and not `exclude`. */
export function listFiles(
  root: string,
  include: readonly string[],
  exclude: readonly string[] = [],
): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (IGNORED_DIRS.has(name)) continue;
        walk(full);
      } else {
        const rel = relative(root, full);
        if (matchesAny(rel, include) && !matchesAny(rel, exclude)) {
          out.push(full);
        }
      }
    }
  };
  walk(root);
  return out.sort();
}
