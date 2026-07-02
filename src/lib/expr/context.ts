import type { RuntimeValue } from "./values";

export type Result = "Succeeded" | "SucceededWithIssues" | "Failed" | "Canceled" | "Skipped" | "NotStarted";

export interface DependencyRecord {
  readonly result: Result;
  readonly outputs: Record<string, RuntimeValue>;
}

/**
 * The evaluation context for a single node (stage, job, or step) in a
 * simulated run. The DAG engine (src/lib/dag) is responsible for building a
 * scoped RunContext per node — e.g. at job scope `dependencies` holds prior
 * jobs *within the same stage*, while at stage scope it holds prior stages.
 * The expression engine itself is scope-agnostic; it just reads whatever is
 * in the context it's given.
 */
export interface RunContext {
  readonly variables: Record<string, RuntimeValue>;
  readonly parameters: Record<string, RuntimeValue>;
  readonly dependencies: Record<string, DependencyRecord>;
  readonly stageDependencies: Record<string, Record<string, DependencyRecord>>;
  /** Rollup result for this node's own scope, used by zero-arg succeeded()/failed()/etc. */
  readonly aggregateStatus: Result;
  /** Shared across every expression evaluated within one simulated run, so counter() persists per prefix. */
  readonly counters: Map<string, number>;
}

export function createRunContext(overrides: Partial<RunContext> = {}): RunContext {
  return {
    variables: {},
    parameters: {},
    dependencies: {},
    stageDependencies: {},
    aggregateStatus: "Succeeded",
    counters: new Map(),
    ...overrides,
  };
}
