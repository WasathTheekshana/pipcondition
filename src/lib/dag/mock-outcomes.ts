import type { Result } from "@/lib/expr/context";

export type MockOutcome = "inherit" | Result;

export interface RunInputs {
  /** Mock pipeline-level variable values (merged with stage/job variables: blocks). */
  readonly variables?: Readonly<Record<string, unknown>>;
  /** Mock top-level parameter values, for conditions that reference `parameters.*` at runtime. */
  readonly parameters?: Readonly<Record<string, unknown>>;
  /** Forces a stage/job/step node to a specific Result, bypassing its normal default/rollup. Its `condition` is still evaluated first - an override only takes effect if the node would run. */
  readonly outcomeOverrides?: Readonly<Record<string, MockOutcome>>;
  /** Output variables a step "would set" if it ran, keyed by step node id -> varName -> value (nothing executes, so this is how the user tells the simulator what a step produces). */
  readonly stepOutputs?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Stage ids deselected via a "stages to run" picker, mirroring Azure's
   * Run-pipeline dialog checkbox list. A deselected stage is forced to
   * Skipped WITHOUT evaluating its own condition at all (it's excluded from
   * consideration entirely, exactly like manually unchecking it before
   * queueing a real run) - unlike outcomeOverrides, which only takes effect
   * if the condition would otherwise pass. Downstream stages then skip via
   * the normal dependency-aggregation cascade unless they use always().
   */
  readonly excludedStages?: readonly string[];
}
