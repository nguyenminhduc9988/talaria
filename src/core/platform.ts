/** Detect which agent harness Talaria is running under, to pick an adapter. */

import { existsSync } from "node:fs";
import { join } from "node:path";

export type Platform =
  | "claude-code"
  | "codex"
  | "opencode"
  | "cursor"
  | "kiro"
  | "hermes"
  | "unknown";

export interface PlatformEnv {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export function detectPlatform(opts: PlatformEnv = {}): Platform {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();

  if (env.HERMES_HOME || existsSync(join(cwd, ".hermes")) || existsSync(join(cwd, "hermes-agent")))
    return "hermes";
  if (env.CLAUDE_CODE || existsSync(join(cwd, ".claude"))) return "claude-code";
  if (env.CODEX_HOME || existsSync(join(cwd, ".codex"))) return "codex";
  if (existsSync(join(cwd, ".opencode"))) return "opencode";
  if (existsSync(join(cwd, ".cursor"))) return "cursor";
  if (existsSync(join(cwd, ".kiro"))) return "kiro";
  return "unknown";
}
