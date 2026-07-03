/**
 * Derives the built-in Azure Pipelines variables that a real push/PR trigger
 * would set, from a few friendly inputs (branch name, trigger reason,
 * PR target branch) - so a `condition:` like
 * `ne(variables['Build.SourceBranch'], 'refs/heads/main')` reacts correctly
 * without the user having to know or type the raw variable names themselves.
 */

export const TRIGGER_REASONS = ["Manual", "IndividualCI", "BatchedCI", "PullRequest", "Schedule"] as const;
export type TriggerReason = (typeof TRIGGER_REASONS)[number];

export interface TriggerSimulation {
  /** A branch name as a developer would type it, e.g. "main" or "Feature/my-feature" - a "refs/heads/" prefix is accepted and stripped. */
  readonly branch: string;
  readonly reason: TriggerReason;
  /** Only meaningful when reason is "PullRequest". */
  readonly targetBranch: string;
}

/** All variable keys deriveTriggerVariables can ever produce - used to clear stale entries (e.g. System.PullRequest.* left over from a prior PullRequest simulation) when the trigger reason changes. */
export const TRIGGER_VARIABLE_KEYS = [
  "Build.Reason",
  "Build.SourceBranch",
  "Build.SourceBranchName",
  "System.PullRequest.PullRequestId",
  "System.PullRequest.SourceBranch",
  "System.PullRequest.TargetBranch",
] as const;

/** Trims, strips a redundant "refs/heads/" prefix and any trailing slashes, and falls back to "main" if that leaves nothing - handles blank input, an already-fully-qualified ref, and a stray trailing slash uniformly. */
function normalizeBranch(branch: string): string {
  const trimmed = branch.trim();
  const stripped = trimmed.replace(/^refs\/heads\//, "").replace(/\/+$/, "");
  return stripped || "main";
}

function lastPathSegment(branch: string): string {
  const segments = branch.split("/");
  return segments[segments.length - 1] || branch;
}

/**
 * Real Azure Pipelines merges PR builds onto a synthetic ref
 * (`refs/pull/<id>/merge`), so `Build.SourceBranch`/`Build.SourceBranchName`
 * do NOT reflect the PR's actual source branch for PullRequest-triggered
 * runs - the real source/target branches only show up under
 * `System.PullRequest.*`. This is genuinely unintuitive but is what Azure
 * actually does, and this simulator mirrors it rather than a friendlier
 * approximation.
 */
export function deriveTriggerVariables(sim: TriggerSimulation): Record<string, string> {
  const shortBranch = normalizeBranch(sim.branch);

  if (sim.reason === "PullRequest") {
    const shortTarget = normalizeBranch(sim.targetBranch);
    return {
      "Build.Reason": sim.reason,
      "Build.SourceBranch": "refs/pull/1/merge",
      "Build.SourceBranchName": "merge",
      "System.PullRequest.PullRequestId": "1",
      "System.PullRequest.SourceBranch": `refs/heads/${shortBranch}`,
      "System.PullRequest.TargetBranch": `refs/heads/${shortTarget}`,
    };
  }

  return {
    "Build.Reason": sim.reason,
    "Build.SourceBranch": `refs/heads/${shortBranch}`,
    "Build.SourceBranchName": lastPathSegment(shortBranch),
  };
}
