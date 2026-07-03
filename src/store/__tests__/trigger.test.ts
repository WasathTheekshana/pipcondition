// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { usePipelineStore } from "../pipeline.store";

describe("usePipelineStore: branch trigger simulation drives stage skip/run", () => {
  it("skips a main-only stage on a feature branch and runs it on main, purely by changing the simulated branch", async () => {
    await usePipelineStore.getState().setFileContent(
      "azure-pipelines.yml",
      `stages:
  - stage: DeployProd
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs: [{ job: J, steps: [{ script: echo }] }]
  - stage: DeployFeaturePreview
    condition: ne(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    );

    // Default trigger is main - the prod stage runs, the feature-preview stage is skipped.
    expect(usePipelineStore.getState().report?.stages.map((s) => [s.name, s.result])).toEqual([
      ["DeployProd", "Succeeded"],
      ["DeployFeaturePreview", "Skipped"],
    ]);

    await usePipelineStore.getState().setTrigger({ branch: "Feature/my-feature" });

    expect(usePipelineStore.getState().variables["Build.SourceBranch"]).toBe("refs/heads/Feature/my-feature");
    expect(usePipelineStore.getState().variables["Build.SourceBranchName"]).toBe("my-feature");
    expect(usePipelineStore.getState().report?.stages.map((s) => [s.name, s.result])).toEqual([
      ["DeployProd", "Skipped"],
      ["DeployFeaturePreview", "Succeeded"],
    ]);
  });

  it("switching the trigger reason to PullRequest sets the synthetic merge ref and System.PullRequest.* variables", async () => {
    await usePipelineStore.getState().setFileContent("azure-pipelines.yml", `stages:\n  - stage: A\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n`);

    await usePipelineStore.getState().setTrigger({ branch: "Feature/my-feature", reason: "PullRequest", targetBranch: "develop" });

    const { variables } = usePipelineStore.getState();
    expect(variables["Build.Reason"]).toBe("PullRequest");
    expect(variables["Build.SourceBranch"]).toBe("refs/pull/1/merge");
    expect(variables["System.PullRequest.SourceBranch"]).toBe("refs/heads/Feature/my-feature");
    expect(variables["System.PullRequest.TargetBranch"]).toBe("refs/heads/develop");
  });

  // Regression: switching the reason away from PullRequest must clear the
  // System.PullRequest.* keys entirely, not just leave them at their last
  // values - otherwise a condition checking System.PullRequest.SourceBranch
  // would incorrectly still see a PR context after switching back to a plain push.
  it("clears stale System.PullRequest.* variables when the reason switches away from PullRequest", async () => {
    await usePipelineStore.getState().setFileContent("azure-pipelines.yml", `stages:\n  - stage: A\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n`);

    await usePipelineStore.getState().setTrigger({ branch: "Feature/x", reason: "PullRequest", targetBranch: "develop" });
    expect(usePipelineStore.getState().variables["System.PullRequest.SourceBranch"]).toBe("refs/heads/Feature/x");

    await usePipelineStore.getState().setTrigger({ reason: "Manual" });

    const { variables } = usePipelineStore.getState();
    expect(variables["System.PullRequest.SourceBranch"]).toBeUndefined();
    expect(variables["System.PullRequest.TargetBranch"]).toBeUndefined();
    expect(variables["System.PullRequest.PullRequestId"]).toBeUndefined();
    expect(variables["Build.Reason"]).toBe("Manual");
    // The branch set before switching reason is preserved, not reset.
    expect(variables["Build.SourceBranch"]).toBe("refs/heads/Feature/x");
  });

  it("a partial setTrigger call only changes the given field(s) and preserves the rest", async () => {
    await usePipelineStore.getState().setFileContent("azure-pipelines.yml", `stages:\n  - stage: A\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n`);

    await usePipelineStore.getState().setTrigger({ branch: "Feature/x" });
    await usePipelineStore.getState().setTrigger({ reason: "Schedule" });

    expect(usePipelineStore.getState().simulatedBranch).toBe("Feature/x");
    expect(usePipelineStore.getState().simulatedReason).toBe("Schedule");
    expect(usePipelineStore.getState().variables["Build.SourceBranch"]).toBe("refs/heads/Feature/x");
    expect(usePipelineStore.getState().variables["Build.Reason"]).toBe("Schedule");
  });

  it("calling setTrigger with no fields re-derives from the existing state without crashing", async () => {
    await usePipelineStore.getState().setFileContent("azure-pipelines.yml", `stages:\n  - stage: A\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n`);
    await usePipelineStore.getState().setTrigger({ branch: "release/2.0" });

    await expect(usePipelineStore.getState().setTrigger({})).resolves.toBeUndefined();
    expect(usePipelineStore.getState().variables["Build.SourceBranch"]).toBe("refs/heads/release/2.0");
  });

  it("does not clobber unrelated custom mock variables set via setVariable", async () => {
    await usePipelineStore.getState().setFileContent("azure-pipelines.yml", `stages:\n  - stage: A\n    jobs: [{ job: J, steps: [{ script: echo }] }]\n`);

    await usePipelineStore.getState().setVariable("MyCustomVar", "hello");
    await usePipelineStore.getState().setTrigger({ branch: "Feature/x", reason: "PullRequest", targetBranch: "main" });

    expect(usePipelineStore.getState().variables["MyCustomVar"]).toBe("hello");
  });

  it("clearAllData resets the simulated trigger back to the main/Manual default", async () => {
    await usePipelineStore.getState().setTrigger({ branch: "Feature/x", reason: "PullRequest", targetBranch: "develop" });
    await usePipelineStore.getState().clearAllData();

    expect(usePipelineStore.getState().simulatedBranch).toBe("main");
    expect(usePipelineStore.getState().simulatedReason).toBe("Manual");
    expect(usePipelineStore.getState().variables["Build.SourceBranch"]).toBe("refs/heads/main");
    expect(usePipelineStore.getState().variables["System.PullRequest.SourceBranch"]).toBeUndefined();
  });
});
