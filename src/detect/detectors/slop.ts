/**
 * Deterministic AI-slop detector for prose (markdown / html body text).
 *
 * Slop = filler phrasing that reads as machine-written, tanks dwell time, and
 * trips "unhelpful content" ranking signals. Each hit carries a safe fix hint.
 */

import type { Detector, Finding, DetectInput } from "../../core/types.ts";

const ID = "slop";

interface SlopRule {
  readonly rule: string;
  readonly re: RegExp;
  readonly severity: Finding["severity"];
  readonly why: string;
  readonly replace?: string;
}

const RULES: readonly SlopRule[] = [
  { rule: "in-todays-world", re: /\bin today's (?:fast-paced|ever-changing|digital) world\b/gi, severity: "warn", why: "Opening filler cliché." },
  { rule: "ever-evolving", re: /\b(?:ever-evolving|ever-changing) landscape\b/gi, severity: "warn", why: "Overused AI cliché." },
  { rule: "important-to-note", re: /\bit(?:'s| is) important to note that\b/gi, severity: "warn", why: "Empty hedge — delete and state the point.", replace: "" },
  { rule: "delve", re: /\b(?:delve|delving) into\b/gi, severity: "info", why: "Signature LLM verb; prefer 'look at' / 'examine'." },
  { rule: "tapestry", re: /\b(?:rich )?tapestry\b/gi, severity: "info", why: "Purple-prose cliché." },
  { rule: "in-conclusion", re: /\bin conclusion\b/gi, severity: "info", why: "Mechanical wrap-up phrase.", replace: "" },
  { rule: "furthermore-stack", re: /\b(?:furthermore|moreover)\b/gi, severity: "info", why: "Overused connective when stacked." },
  { rule: "unleash-unlock", re: /\b(?:unleash|unlock) (?:the power|your potential|the full potential)\b/gi, severity: "warn", why: "Marketing-slop verb phrase." },
  { rule: "game-changer", re: /\bgame[- ]?changer\b/gi, severity: "info", why: "Cliché intensifier." },
  { rule: "navigate-complexities", re: /\bnavigat(?:e|ing) the complexit(?:y|ies)\b/gi, severity: "info", why: "LLM filler." },
  { rule: "when-it-comes-to", re: /\bwhen it comes to\b/gi, severity: "info", why: "Wordy lead-in; cut to the noun." },
  { rule: "at-the-end-of-day", re: /\bat the end of the day\b/gi, severity: "info", why: "Filler idiom.", replace: "" },
];

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export const slopDetector: Detector = {
  id: ID,
  title: "AI-slop prose patterns",

  applies({ kind }) {
    return kind === "markdown" || kind === "html" || kind === "text";
  },

  detect({ file, content }: DetectInput): Finding[] {
    const out: Finding[] = [];
    for (const r of RULES) {
      r.re.lastIndex = 0;
      for (let m = r.re.exec(content); m; m = r.re.exec(content)) {
        const line = lineOf(content, m.index);
        out.push({
          id: `${ID}:${file}:${line}:${r.rule}`,
          detector: ID,
          rule: r.rule,
          severity: r.severity,
          message: `Slop: "${m[0]}" — ${r.why}`,
          file,
          line,
          ...(r.replace !== undefined ? { fix: { find: m[0], replace: r.replace } } : {}),
        });
        if (m.index === r.re.lastIndex) r.re.lastIndex++; // avoid zero-width stall
      }
    }
    return out;
  },
};
