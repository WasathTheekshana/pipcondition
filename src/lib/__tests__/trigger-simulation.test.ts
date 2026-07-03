import { describe, expect, it } from "vitest";
import { deriveTriggerVariables, TRIGGER_REASONS } from "../trigger-simulation";

describe("deriveTriggerVariables: plain branch pushes", () => {
  it("derives Build.SourceBranch/SourceBranchName for a single-segment branch", () => {
    expect(deriveTriggerVariables({ branch: "main", reason: "Manual", targetBranch: "main" })).toEqual({
      "Build.Reason": "Manual",
      "Build.SourceBranch": "refs/heads/main",
      "Build.SourceBranchName": "main",
    });
  });

  it("uses the last path segment as SourceBranchName for a nested branch like Feature/<name>", () => {
    const result = deriveTriggerVariables({ branch: "Feature/my-feature", reason: "IndividualCI", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/Feature/my-feature");
    expect(result["Build.SourceBranchName"]).toBe("my-feature");
    expect(result["Build.Reason"]).toBe("IndividualCI");
  });

  it("handles a release branch with a dotted name", () => {
    const result = deriveTriggerVariables({ branch: "release/2.0", reason: "BatchedCI", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/release/2.0");
    expect(result["Build.SourceBranchName"]).toBe("2.0");
  });

  it("handles a deeply nested branch (multiple slashes)", () => {
    const result = deriveTriggerVariables({ branch: "team/alice/my-feature", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/team/alice/my-feature");
    expect(result["Build.SourceBranchName"]).toBe("my-feature");
  });

  it("preserves dashes, underscores, and dots in a single-segment branch name", () => {
    const result = deriveTriggerVariables({ branch: "hotfix/JIRA-123_fix.v2", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/hotfix/JIRA-123_fix.v2");
    expect(result["Build.SourceBranchName"]).toBe("JIRA-123_fix.v2");
  });

  it("preserves branch name casing exactly (branch names are case-sensitive in git)", () => {
    const result = deriveTriggerVariables({ branch: "Feature/MyFeature", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/Feature/MyFeature");
    expect(result["Build.SourceBranchName"]).toBe("MyFeature");
  });

  it("strips a refs/heads/ prefix if the user already typed one", () => {
    const result = deriveTriggerVariables({ branch: "refs/heads/main", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/main");
    expect(result["Build.SourceBranchName"]).toBe("main");
  });

  it("strips a refs/heads/ prefix on a nested branch too", () => {
    const result = deriveTriggerVariables({ branch: "refs/heads/Feature/my-feature", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/Feature/my-feature");
    expect(result["Build.SourceBranchName"]).toBe("my-feature");
  });

  it("falls back to main when the branch is blank or whitespace-only", () => {
    expect(deriveTriggerVariables({ branch: "", reason: "Manual", targetBranch: "main" })["Build.SourceBranch"]).toBe("refs/heads/main");
    expect(deriveTriggerVariables({ branch: "   ", reason: "Manual", targetBranch: "main" })["Build.SourceBranch"]).toBe("refs/heads/main");
  });

  it("trims leading/trailing whitespace around an otherwise valid branch name", () => {
    const result = deriveTriggerVariables({ branch: "  Feature/my-feature  ", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/Feature/my-feature");
    expect(result["Build.SourceBranchName"]).toBe("my-feature");
  });

  it("falls back to main when the branch is only a refs/heads/ prefix with nothing after it", () => {
    const result = deriveTriggerVariables({ branch: "refs/heads/", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/main");
    expect(result["Build.SourceBranchName"]).toBe("main");
  });

  it("strips a stray trailing slash instead of producing an empty SourceBranchName", () => {
    const result = deriveTriggerVariables({ branch: "Feature/my-feature/", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/Feature/my-feature");
    expect(result["Build.SourceBranchName"]).toBe("my-feature");
  });

  it("falls back to main when the branch is only slashes", () => {
    const result = deriveTriggerVariables({ branch: "///", reason: "Manual", targetBranch: "main" });
    expect(result["Build.SourceBranch"]).toBe("refs/heads/main");
    expect(result["Build.SourceBranchName"]).toBe("main");
  });

  it("does not include any System.PullRequest.* keys for a non-PullRequest reason", () => {
    for (const reason of TRIGGER_REASONS.filter((r) => r !== "PullRequest")) {
      const result = deriveTriggerVariables({ branch: "main", reason, targetBranch: "main" });
      expect(Object.keys(result).some((k) => k.startsWith("System.PullRequest."))).toBe(false);
    }
  });

  it("produces the exact Build.Reason value for every non-PullRequest trigger reason", () => {
    for (const reason of TRIGGER_REASONS.filter((r) => r !== "PullRequest")) {
      expect(deriveTriggerVariables({ branch: "main", reason, targetBranch: "main" })["Build.Reason"]).toBe(reason);
    }
  });
});

// Real Azure merges PR builds onto refs/pull/<id>/merge - Build.SourceBranch
// does NOT reflect the PR's actual branch; only System.PullRequest.* does.
describe("deriveTriggerVariables: PullRequest reason", () => {
  it("derives the PR-specific synthetic merge ref and System.PullRequest.* variables", () => {
    const result = deriveTriggerVariables({ branch: "Feature/my-feature", reason: "PullRequest", targetBranch: "develop" });
    expect(result).toEqual({
      "Build.Reason": "PullRequest",
      "Build.SourceBranch": "refs/pull/1/merge",
      "Build.SourceBranchName": "merge",
      "System.PullRequest.PullRequestId": "1",
      "System.PullRequest.SourceBranch": "refs/heads/Feature/my-feature",
      "System.PullRequest.TargetBranch": "refs/heads/develop",
    });
  });

  it("normalizes the target branch the same way as the source branch (prefix stripping, whitespace, fallback)", () => {
    expect(deriveTriggerVariables({ branch: "feature/x", reason: "PullRequest", targetBranch: "refs/heads/release/2.0" })["System.PullRequest.TargetBranch"]).toBe(
      "refs/heads/release/2.0",
    );
    expect(deriveTriggerVariables({ branch: "feature/x", reason: "PullRequest", targetBranch: "  develop  " })["System.PullRequest.TargetBranch"]).toBe("refs/heads/develop");
    expect(deriveTriggerVariables({ branch: "feature/x", reason: "PullRequest", targetBranch: "" })["System.PullRequest.TargetBranch"]).toBe("refs/heads/main");
  });

  it("keeps Build.SourceBranch/SourceBranchName constant regardless of the actual source/target branch values", () => {
    const a = deriveTriggerVariables({ branch: "feature/a", reason: "PullRequest", targetBranch: "main" });
    const b = deriveTriggerVariables({ branch: "team/alice/deep/branch", reason: "PullRequest", targetBranch: "release/9.9" });
    expect(a["Build.SourceBranch"]).toBe("refs/pull/1/merge");
    expect(b["Build.SourceBranch"]).toBe("refs/pull/1/merge");
    expect(a["Build.SourceBranchName"]).toBe("merge");
    expect(b["Build.SourceBranchName"]).toBe("merge");
  });
});
