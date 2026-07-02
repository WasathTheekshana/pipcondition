import { describe, expect, it } from "vitest";
import { createBrowserVfs, resolvePipeline } from "@/lib/template";
import type { Diagnostic } from "@/lib/template";
import { buildGraph, simulateRun } from "@/lib/dag";
import { DEFAULT_YAML } from "../pipeline.store";

// Regression coverage for the app's built-in example pipeline: it exercises
// runtime parameters (boolean + choice), a compile-time ${{ }} expression
// embedded inside a runtime `condition:`, and a multi-stage dependsOn graph -
// exactly the surface the UI's default view demonstrates on first load.
describe("DEFAULT_YAML (the app's example pipeline)", () => {
  async function resolveAndSimulate(parameters: Record<string, unknown> = {}) {
    const vfs = createBrowserVfs({ "azure-pipelines.yml": DEFAULT_YAML });
    const { ir, diagnostics, parameterDeclarations } = await resolvePipeline("azure-pipelines.yml", vfs, { parameters });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const dagDiagnostics: Diagnostic[] = [];
    const graph = buildGraph(ir, dagDiagnostics);
    expect(dagDiagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const report = simulateRun(graph, { parameters });
    return { report, parameterDeclarations };
  }

  it("declares the runTests and targetEnv parameters for the UI to render controls for", async () => {
    const { parameterDeclarations } = await resolveAndSimulate();
    expect(parameterDeclarations.map((d) => d.name)).toEqual(["runTests", "targetEnv"]);
  });

  it("with runTests=true (default), Build/Test/Deploy all succeed", async () => {
    const { report } = await resolveAndSimulate({ runTests: true, targetEnv: "staging" });
    expect(report.stages.map((s) => [s.name, s.result])).toEqual([
      ["Build", "Succeeded"],
      ["Test", "Succeeded"],
      ["Deploy", "Succeeded"],
    ]);
  });

  it("with runTests=false, Test is skipped (compile-time parameter gate) but Deploy still runs", async () => {
    const { report } = await resolveAndSimulate({ runTests: false, targetEnv: "staging" });
    expect(report.stages.map((s) => [s.name, s.result])).toEqual([
      ["Build", "Succeeded"],
      ["Test", "Skipped"],
      ["Deploy", "Succeeded"],
    ]);
  });
});
