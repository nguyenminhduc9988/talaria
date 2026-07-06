export { seoDetector } from "./seo.ts";
export { slopDetector } from "./slop.ts";

import { seoDetector } from "./seo.ts";
import { slopDetector } from "./slop.ts";
import type { Detector } from "../../core/types.ts";

export const builtinDetectors: readonly Detector[] = [seoDetector, slopDetector];
