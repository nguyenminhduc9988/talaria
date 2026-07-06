/** Talaria public API + a preconfigured registry of all built-in modules. */

export * from "./core/types.ts";
export { Registry } from "./core/registry.ts";
export { runPipeline, noopRunner, dedupe } from "./core/pipeline.ts";
export type { AgentRunner, AgentContext, AgentOutcome, RunOptions } from "./core/pipeline.ts";
export { createLogger } from "./core/logger.ts";
export type { Logger } from "./core/logger.ts";
export { detectPlatform } from "./core/platform.ts";
export type { Platform } from "./core/platform.ts";
export {
  newRun,
  loadRun,
  saveRun,
  latestRun,
  makeRunId,
  systemClock,
} from "./core/state.ts";
export type { Clock } from "./core/state.ts";
export { builtinDetectors } from "./detect/detectors/index.ts";
export { builtinModules } from "./modules/index.ts";

import { Registry } from "./core/registry.ts";
import { builtinModules } from "./modules/index.ts";

/** Build a registry with every built-in module registered and validated. */
export function bootRegistry(): Registry {
  const reg = new Registry();
  for (const mod of builtinModules) reg.register(mod);
  const errors = reg.validate();
  if (errors.length > 0) {
    throw new Error(`Registry validation failed:\n  ${errors.join("\n  ")}`);
  }
  return reg;
}
