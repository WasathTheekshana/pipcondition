import type { Result } from "@/lib/expr/context";

/**
 * succeeded()/failed()/canceled()/succeededOrFailed() with no arguments
 * aggregate over the node's own dependencies: `dependsOn` results for
 * stages/jobs, or preceding steps in the same job for steps (steps have no
 * dependsOn). Both scopes reduce their dependency set with this same rule.
 */
export function aggregateStatus(dependencyResults: readonly Result[]): Result {
  if (dependencyResults.length === 0) return "Succeeded";
  if (dependencyResults.some((r) => r === "Canceled")) return "Canceled";
  if (dependencyResults.some((r) => r === "Failed")) return "Failed";
  if (dependencyResults.every((r) => r === "Skipped")) return "Skipped";
  if (dependencyResults.some((r) => r === "SucceededWithIssues")) return "SucceededWithIssues";
  return "Succeeded";
}

/**
 * Rolls up a composite node's (job from steps, stage from jobs) actual
 * Result from its children. `allowFailure[i]` is a child's own
 * `continueOnError` (a step-only concept in Azure); pass an all-false/empty
 * array for job->stage rollups, which have no such escape hatch.
 */
export function rollupResults(childResults: readonly Result[], allowFailure: readonly boolean[] = []): Result {
  if (childResults.length === 0) return "Succeeded";
  if (childResults.every((r) => r === "Skipped")) return "Skipped";
  if (childResults.some((r) => r === "Canceled")) return "Canceled";

  let hasIssues = false;
  for (let i = 0; i < childResults.length; i++) {
    const r = childResults[i];
    if (r === "Failed") {
      if (allowFailure[i]) hasIssues = true;
      else return "Failed";
    } else if (r === "SucceededWithIssues") {
      hasIssues = true;
    }
  }
  return hasIssues ? "SucceededWithIssues" : "Succeeded";
}
