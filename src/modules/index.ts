import type { Module } from "../core/types.ts";
import { siteBoostModule } from "./site-boost.ts";
import { codeReviewModule } from "./code-review.ts";

export { siteBoostModule } from "./site-boost.ts";
export { codeReviewModule } from "./code-review.ts";

/** All in-tree modules. Add new modules here — no external repo fetching. */
export const builtinModules: readonly Module[] = [siteBoostModule, codeReviewModule];
