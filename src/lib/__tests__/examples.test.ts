import { describe, expect, it } from "vitest";
import { EXAMPLE_PIPELINES } from "../examples";
import { createBrowserVfs, resolvePipeline, type Diagnostic } from "../template";
import { buildGraph, simulateRun } from "../dag";

describe("EXAMPLE_PIPELINES", () => {
  it("has unique ids", () => {
    const ids = EXAMPLE_PIPELINES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const example of EXAMPLE_PIPELINES) {
    it(`"${example.name}" resolves and simulates without errors`, async () => {
      const vfs = createBrowserVfs({ "azure-pipelines.yml": example.yaml });
      const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs, {});
      expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      expect(ir.stages.length).toBeGreaterThan(0);

      const dagDiagnostics: Diagnostic[] = [];
      const graph = buildGraph(ir, dagDiagnostics);
      expect(dagDiagnostics.filter((d) => d.severity === "error")).toEqual([]);

      // Must not throw - this is what recomputeRun does on every mutation.
      expect(() => simulateRun(graph, {})).not.toThrow();
    });
  }
});
