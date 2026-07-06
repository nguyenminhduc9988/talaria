/**
 * code-review — reimplemented review pipeline.
 *
 * A single-responsibility reviewer agent inspects the working tree and emits
 * findings; a gate blocks delivery on unresolved `error`+ findings. The agent's
 * concrete backend (Claude Code subagent, Hermes delegate, etc.) is injected by
 * the runner, so the same pipeline runs on any platform.
 */

import type { Module, Pipeline, AgentSpec } from "../core/types.ts";

const reviewer: AgentSpec = {
  name: "reviewer",
  role: "Correctness-focused code reviewer",
  model: "opus",
  description: "Reviews the current diff for correctness bugs and risky changes.",
  instructions: `Review the current working-tree diff. Focus on:
- Correctness bugs, off-by-one, null/undefined, race conditions.
- Broken invariants, unhandled errors, resource leaks.
- Security-relevant changes (injection, authz, secrets).
Emit one finding per real issue with file:line and a concrete failure scenario.
Do NOT report style nits. Return findings you could not resolve as open.`,
  tools: ["read", "grep", "bash"],
};

const pipeline: Pipeline = {
  id: "code-review",
  title: "Code Review",
  description: "Correctness review of the working diff, gated before delivery.",
  phases: [
    {
      id: "review",
      title: "Review",
      steps: [{ kind: "agent", id: "review-diff", agent: "reviewer", consumes: ["*"] }],
    },
    {
      id: "gate",
      title: "Gate",
      steps: [
        {
          kind: "gate",
          id: "no-review-errors",
          maxSeverity: "error",
          reason: "Reviewer found unresolved correctness issues",
        },
      ],
    },
  ],
};

export const codeReviewModule: Module = {
  id: "code-review",
  title: "Code Review",
  description: "Correctness-focused review pipeline.",
  agents: [reviewer],
  pipelines: [pipeline],
};
