/**
 * site-boost — the traffic module.
 *
 * Runs deterministic SEO + slop detection over a website's HTML/markdown, then
 * (optionally) hands the findings to an editor agent that applies fixes, and
 * finally gates on remaining `error`-level SEO issues. This is the pipeline the
 * Hermes integration schedules against the live sites.
 */

import type { Module, Pipeline, AgentSpec } from "../core/types.ts";
import { seoDetector } from "../detect/detectors/seo.ts";
import { slopDetector } from "../detect/detectors/slop.ts";

const seoEditor: AgentSpec = {
  name: "seo-editor",
  role: "Website SEO & content editor",
  model: "sonnet",
  description:
    "Applies SEO and slop findings to source files, preserving meaning and voice.",
  instructions: `You receive a list of deterministic findings (missing meta tags,
alt text, JSON-LD, slop phrases). For each finding:
- Apply the smallest correct edit to the source file that resolves it.
- Never invent facts; for meta descriptions, summarize existing page content.
- Preserve the author's voice; when removing slop, keep the sentence readable.
- Report any finding you could NOT safely auto-fix so a gate can catch it.
Output only the findings that remain open after your edits.`,
  tools: ["read", "edit"],
};

const pipeline: Pipeline = {
  id: "site-boost",
  title: "Site Boost — SEO + content quality",
  description: "Detect and fix SEO gaps and AI-slop across a site's HTML/markdown.",
  phases: [
    {
      id: "scan",
      title: "Deterministic scan",
      steps: [
        {
          kind: "check",
          id: "scan-seo",
          detectors: ["seo"],
          include: ["**/*.html", "**/*.htm"],
        },
        {
          kind: "check",
          id: "scan-slop",
          detectors: ["slop"],
          include: ["**/*.html", "**/*.md"],
        },
      ],
    },
    {
      id: "fix",
      title: "Agent remediation",
      steps: [
        { kind: "agent", id: "apply-fixes", agent: "seo-editor", consumes: ["seo", "slop"] },
      ],
    },
    {
      id: "verify",
      title: "Quality gate",
      steps: [
        {
          kind: "gate",
          id: "no-seo-errors",
          maxSeverity: "error",
          reason: "Unresolved error-level SEO issues remain",
        },
      ],
    },
  ],
};

export const siteBoostModule: Module = {
  id: "site-boost",
  title: "Site Boost",
  description: "SEO + content-quality pipeline for static sites.",
  detectors: [seoDetector, slopDetector],
  agents: [seoEditor],
  pipelines: [pipeline],
};
