import { describe, expect, it } from "vitest";
import { buildGraph } from "../build-graph";
import type { Diagnostic } from "@/lib/template/pipeline-ir";
import { stage, job, step, pipeline } from "./helpers";

describe("buildGraph: dependsOn defaults", () => {
  it("stages default to sequential (each depends on the previous) when dependsOn is omitted", () => {
    const ir = pipeline([stage({ name: "A" }), stage({ name: "B" }), stage({ name: "C" })]);
    const diagnostics: Diagnostic[] = [];
    const graph = buildGraph(ir, diagnostics);
    expect(graph.stages[0].dependsOn).toEqual([]);
    expect(graph.stages[1].dependsOn).toEqual(["A"]);
    expect(graph.stages[2].dependsOn).toEqual(["B"]);
  });

  it("an explicit empty dependsOn on a stage means no dependencies (parallel with the first wave)", () => {
    const ir = pipeline([stage({ name: "A" }), stage({ name: "B", dependsOn: [] })]);
    const graph = buildGraph(ir, []);
    expect(graph.stages[1].dependsOn).toEqual([]);
  });

  it("jobs default to PARALLEL (no dependency) when dependsOn is omitted, unlike stages", () => {
    const ir = pipeline([stage({ name: "S", jobs: [job({ name: "A" }), job({ name: "B" })] })]);
    const graph = buildGraph(ir, []);
    expect(graph.stages[0].jobs[0].dependsOn).toEqual([]);
    expect(graph.stages[0].jobs[1].dependsOn).toEqual([]);
  });

  it("resolves explicit job dependsOn to namespaced job ids within the same stage", () => {
    const ir = pipeline([stage({ name: "S", jobs: [job({ name: "A" }), job({ name: "B", dependsOn: ["A"] })] })]);
    const graph = buildGraph(ir, []);
    expect(graph.stages[0].jobs[1].dependsOn).toEqual(["S/A"]);
  });
});

describe("buildGraph: diagnostics", () => {
  it("flags a stage depending on an unknown stage", () => {
    const ir = pipeline([stage({ name: "A", dependsOn: ["Nonexistent"] })]);
    const diagnostics: Diagnostic[] = [];
    buildGraph(ir, diagnostics);
    expect(diagnostics.some((d) => d.severity === "error" && /unknown stage 'Nonexistent'/.test(d.message))).toBe(true);
  });

  it("flags a job depending on an unknown job in the same stage", () => {
    const ir = pipeline([stage({ name: "S", jobs: [job({ name: "A", dependsOn: ["Nope"] })] })]);
    const diagnostics: Diagnostic[] = [];
    buildGraph(ir, diagnostics);
    expect(diagnostics.some((d) => d.severity === "error" && /unknown job 'Nope'/.test(d.message))).toBe(true);
  });

  it("flags a cycle among stage dependsOn", () => {
    const ir = pipeline([stage({ name: "A", dependsOn: ["B"] }), stage({ name: "B", dependsOn: ["A"] })]);
    const diagnostics: Diagnostic[] = [];
    buildGraph(ir, diagnostics);
    expect(diagnostics.some((d) => /Cycle detected among stage/.test(d.message))).toBe(true);
  });

  it("flags a cycle among job dependsOn within a stage", () => {
    const ir = pipeline([stage({ name: "S", jobs: [job({ name: "A", dependsOn: ["B"] }), job({ name: "B", dependsOn: ["A"] })] })]);
    const diagnostics: Diagnostic[] = [];
    buildGraph(ir, diagnostics);
    expect(diagnostics.some((d) => /Cycle detected among job/.test(d.message))).toBe(true);
  });
});

describe("buildGraph: step node ids stay unique even with duplicate step names", () => {
  it("suffixes step ids with their index", () => {
    const ir = pipeline([stage({ name: "S", jobs: [job({ name: "J", steps: [step({ name: "echo" }), step({ name: "echo" })] })] })]);
    const graph = buildGraph(ir, []);
    const ids = graph.stages[0].jobs[0].steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });
});
