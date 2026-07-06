/**
 * Deterministic SEO / discoverability detector for HTML.
 *
 * This is the traffic engine: every finding is a concrete, well-established
 * ranking or click-through factor (title/meta/canonical/OG/Twitter/JSON-LD/alt/
 * viewport/lang/heading structure/lazy images). No tokens, no guessing.
 */

import type { Detector, Finding, DetectInput } from "../../core/types.ts";

const ID = "seo";

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function has(re: RegExp, s: string): boolean {
  return re.test(s);
}

function finding(
  rule: string,
  severity: Finding["severity"],
  message: string,
  file: string,
  line: number,
): Finding {
  return { id: `${ID}:${file}:${line}:${rule}`, detector: ID, rule, severity, message, file, line };
}

export const seoDetector: Detector = {
  id: ID,
  title: "SEO & discoverability (HTML)",

  applies({ kind }) {
    return kind === "html";
  },

  detect({ file, content }: DetectInput): Finding[] {
    const out: Finding[] = [];
    const head = content.slice(0, Math.max(content.indexOf("</head>"), 4000));

    // <title>
    if (!has(/<title[^>]*>\s*\S/i, head)) {
      out.push(finding("missing-title", "error", "No non-empty <title> — primary SERP factor.", file, 1));
    } else {
      const m = /<title[^>]*>([^<]*)<\/title>/i.exec(head);
      const len = m?.[1]?.trim().length ?? 0;
      if (len > 60) out.push(finding("title-too-long", "warn", `<title> is ${len} chars; keep <=60 to avoid truncation.`, file, lineOf(content, m!.index)));
    }

    // meta description
    const desc = /<meta[^>]+name=["']description["'][^>]*>/i.exec(head);
    if (!desc) {
      out.push(finding("missing-meta-description", "error", "No meta description — drives SERP click-through.", file, 1));
    } else {
      const c = /content=["']([^"']*)["']/i.exec(desc[0])?.[1]?.trim() ?? "";
      if (c.length === 0) out.push(finding("empty-meta-description", "error", "meta description is empty.", file, lineOf(content, desc.index)));
      else if (c.length > 160) out.push(finding("meta-description-long", "warn", `meta description ${c.length} chars; keep <=160.`, file, lineOf(content, desc.index)));
    }

    // canonical
    if (!has(/<link[^>]+rel=["']canonical["']/i, head)) {
      out.push(finding("missing-canonical", "warn", "No rel=canonical — risks duplicate-content dilution.", file, 1));
    }

    // viewport (mobile ranking)
    if (!has(/<meta[^>]+name=["']viewport["']/i, head)) {
      out.push(finding("missing-viewport", "error", "No viewport meta — fails mobile usability.", file, 1));
    }

    // lang attribute
    if (!has(/<html[^>]+lang=/i, content)) {
      out.push(finding("missing-lang", "warn", "<html> has no lang attribute — a11y + international SEO.", file, 1));
    }

    // Open Graph
    for (const prop of ["og:title", "og:description", "og:image"]) {
      if (!has(new RegExp(`<meta[^>]+property=["']${prop}["']`, "i"), head)) {
        out.push(finding(`missing-${prop.replace(":", "-")}`, "warn", `No ${prop} — weak social/link-preview CTR.`, file, 1));
      }
    }

    // Twitter card
    if (!has(/<meta[^>]+name=["']twitter:card["']/i, head)) {
      out.push(finding("missing-twitter-card", "info", "No twitter:card meta.", file, 1));
    }

    // JSON-LD structured data
    if (!has(/<script[^>]+type=["']application\/ld\+json["']/i, content)) {
      out.push(finding("missing-json-ld", "warn", "No JSON-LD structured data — forfeits rich results.", file, 1));
    }

    // Headings: exactly one H1
    const h1s = content.match(/<h1[\s>]/gi)?.length ?? 0;
    if (h1s === 0) out.push(finding("no-h1", "error", "No <h1> — every page needs one topical H1.", file, 1));
    else if (h1s > 1) out.push(finding("multiple-h1", "warn", `${h1s} <h1> tags — use exactly one.`, file, 1));

    // Images: alt text + lazy + dimensions
    const imgRe = /<img\b[^>]*>/gi;
    for (let m = imgRe.exec(content); m; m = imgRe.exec(content)) {
      const tag = m[0];
      const line = lineOf(content, m.index);
      if (!/\balt=/i.test(tag)) out.push(finding("img-missing-alt", "error", "<img> missing alt — a11y + image SEO.", file, line));
      else if (/\balt=["']\s*["']/i.test(tag) && !/\brole=["']presentation["']/i.test(tag))
        out.push(finding("img-empty-alt", "warn", "<img> has empty alt (only OK for decorative images).", file, line));
      if (!/\bloading=/i.test(tag)) out.push(finding("img-no-lazy", "info", "<img> lacks loading=\"lazy\" — hurts LCP.", file, line));
      if (!/\bwidth=/i.test(tag) || !/\bheight=/i.test(tag)) out.push(finding("img-no-dimensions", "warn", "<img> lacks width/height — causes CLS.", file, line));
    }

    return out;
  },
};
