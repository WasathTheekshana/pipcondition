// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { usePipelineStore, getShareState } from "../pipeline.store";
import { encodeShareState, decodeShareState } from "@/lib/share-link";

describe("usePipelineStore: share state round-trip", () => {
  it("getShareState -> loadSharedState reproduces the exact same simulated run", async () => {
    await usePipelineStore.getState().setFileContent(
      "azure-pipelines.yml",
      `stages:
  - stage: A
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs: [{ job: J, steps: [{ script: echo hi }] }]
  - stage: B
    dependsOn: A
    jobs: [{ job: J2, steps: [{ script: echo bye }] }]
`,
    );
    await usePipelineStore.getState().setVariable("MyCustomVar", "hello");
    await usePipelineStore.getState().setTrigger({ branch: "Feature/x", reason: "Manual" });
    usePipelineStore.getState().setOutcomeOverride("A", "Failed");
    usePipelineStore.getState().toggleStageExcluded("B");

    const beforeReport = usePipelineStore.getState().report;
    const shared = getShareState(usePipelineStore.getState());

    // Simulate a totally different starting point (like a fresh browser).
    await usePipelineStore.getState().clearAllData();
    expect(usePipelineStore.getState().report).not.toEqual(beforeReport);

    await usePipelineStore.getState().loadSharedState(shared);

    expect(usePipelineStore.getState().files).toEqual(shared.files);
    expect(usePipelineStore.getState().variables).toEqual(shared.variables);
    expect(usePipelineStore.getState().outcomeOverrides).toEqual({ A: "Failed" });
    expect(usePipelineStore.getState().excludedStages).toEqual(["B"]);
    expect(usePipelineStore.getState().simulatedBranch).toBe("Feature/x");
    expect(usePipelineStore.getState().report?.stages.map((s) => [s.name, s.result])).toEqual(beforeReport?.stages.map((s) => [s.name, s.result]));
  });

  it("survives a full encode -> decode -> load round trip through the URL-hash format", async () => {
    await usePipelineStore.getState().setFileContent("azure-pipelines.yml", `stages:\n  - stage: Only\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n`);
    await usePipelineStore.getState().setParameter("someParam", ["x", "y"]);

    const shared = getShareState(usePipelineStore.getState());
    const encoded = encodeShareState(shared);
    const decoded = decodeShareState(encoded);
    expect(decoded).not.toBeNull();

    await usePipelineStore.getState().clearAllData();
    await usePipelineStore.getState().loadSharedState(decoded!);

    expect(usePipelineStore.getState().parameters).toEqual({ someParam: ["x", "y"] });
    expect(usePipelineStore.getState().report?.stages.map((s) => s.name)).toEqual(["Only"]);
  });

  it("loadSharedState falls back to the built-in demo when the shared files map is empty", async () => {
    await usePipelineStore.getState().loadSharedState({
      files: {},
      entryPath: "azure-pipelines.yml",
      variables: {},
      parameters: {},
      outcomeOverrides: {},
      stepOutputs: {},
      excludedStages: [],
      simulatedBranch: "main",
      simulatedReason: "Manual",
      simulatedTargetBranch: "main",
    });

    expect(Object.keys(usePipelineStore.getState().files).length).toBeGreaterThan(0);
    expect(usePipelineStore.getState().parseError).toBeNull();
  });

  it("loadSharedState recovers when entryPath doesn't match any file in a hand-crafted/corrupted share payload", async () => {
    await usePipelineStore.getState().loadSharedState({
      files: { "custom-pipeline.yml": "stages:\n  - stage: X\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n" },
      entryPath: "does-not-exist.yml",
      variables: {},
      parameters: {},
      outcomeOverrides: {},
      stepOutputs: {},
      excludedStages: [],
      simulatedBranch: "main",
      simulatedReason: "Manual",
      simulatedTargetBranch: "main",
    });

    expect(usePipelineStore.getState().entryPath).toBe("custom-pipeline.yml");
    expect(usePipelineStore.getState().parseError).toBeNull();
    expect(usePipelineStore.getState().report?.stages.map((s) => s.name)).toEqual(["X"]);
  });
});
