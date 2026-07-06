/**
 * Central registry. Modules register their detectors, agents, and pipelines here.
 * Everything is in-process and in-tree — no network fetch of external plugin repos,
 * which is the key ownership/reliability improvement over a marketplace-installer model.
 */

import type { Module, Detector, AgentSpec, Pipeline } from "./types.ts";

export class Registry {
  private readonly modules = new Map<string, Module>();
  private readonly detectors = new Map<string, Detector>();
  private readonly agents = new Map<string, AgentSpec>();
  private readonly pipelines = new Map<string, Pipeline>();

  register(mod: Module): this {
    if (this.modules.has(mod.id)) {
      throw new Error(`Module already registered: ${mod.id}`);
    }
    this.modules.set(mod.id, mod);
    for (const d of mod.detectors ?? []) this.addDetector(mod.id, d);
    for (const a of mod.agents ?? []) this.addAgent(mod.id, a);
    for (const p of mod.pipelines ?? []) this.addPipeline(mod.id, p);
    return this;
  }

  private addDetector(modId: string, d: Detector): void {
    if (this.detectors.has(d.id)) {
      throw new Error(`Duplicate detector id "${d.id}" (from module ${modId})`);
    }
    this.detectors.set(d.id, d);
  }

  private addAgent(modId: string, a: AgentSpec): void {
    if (this.agents.has(a.name)) {
      throw new Error(`Duplicate agent "${a.name}" (from module ${modId})`);
    }
    this.agents.set(a.name, a);
  }

  private addPipeline(modId: string, p: Pipeline): void {
    if (this.pipelines.has(p.id)) {
      throw new Error(`Duplicate pipeline "${p.id}" (from module ${modId})`);
    }
    this.pipelines.set(p.id, p);
  }

  detector(id: string): Detector {
    const d = this.detectors.get(id);
    if (!d) throw new Error(`Unknown detector: ${id}`);
    return d;
  }

  agent(name: string): AgentSpec {
    const a = this.agents.get(name);
    if (!a) throw new Error(`Unknown agent: ${name}`);
    return a;
  }

  pipeline(id: string): Pipeline {
    const p = this.pipelines.get(id);
    if (!p) throw new Error(`Unknown pipeline: ${id}`);
    return p;
  }

  listModules(): Module[] {
    return [...this.modules.values()];
  }
  listDetectors(): Detector[] {
    return [...this.detectors.values()];
  }
  listPipelines(): Pipeline[] {
    return [...this.pipelines.values()];
  }
  listAgents(): AgentSpec[] {
    return [...this.agents.values()];
  }

  /**
   * Validate cross-references before any run: every detector/agent named by a
   * pipeline step must exist. Catches config drift at load time, not mid-run.
   */
  validate(): string[] {
    const errors: string[] = [];
    for (const p of this.pipelines.values()) {
      for (const phase of p.phases) {
        for (const step of phase.steps) {
          if (step.kind === "check") {
            for (const id of step.detectors) {
              if (!this.detectors.has(id)) {
                errors.push(`pipeline ${p.id}/${step.id}: unknown detector "${id}"`);
              }
            }
          } else if (step.kind === "agent") {
            if (!this.agents.has(step.agent)) {
              errors.push(`pipeline ${p.id}/${step.id}: unknown agent "${step.agent}"`);
            }
          }
        }
      }
    }
    return errors;
  }
}
