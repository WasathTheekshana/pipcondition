/**
 * The contract between the YAML/template resolver (this module) and the DAG
 * simulation engine (src/lib/dag). `condition`/`variables` values are left as
 * raw expression source strings here — they're only evaluated once the DAG
 * engine builds a scoped RunContext per simulated node.
 */

import type { ParameterDeclaration } from "./parameters";

export interface Diagnostic {
  readonly severity: "error" | "warning";
  readonly message: string;
  /** A human-readable location, e.g. "stages[0].jobs[1]" or a file path. */
  readonly path: string;
}

export interface MatrixStrategy {
  readonly matrix: Record<string, Record<string, string>>;
  readonly maxParallel?: number;
}

export interface StepIR {
  readonly name: string;
  readonly displayName: string;
  readonly condition: string;
  readonly continueOnError: boolean;
  readonly enabled: boolean;
  readonly kind: "script" | "task" | "checkout" | "unknown";
  readonly raw: Record<string, unknown>;
}

export interface JobIR {
  readonly name: string;
  readonly displayName: string;
  /**
   * `undefined` means `dependsOn` was omitted entirely, which for JOBS means
   * "runs in parallel with no dependencies" (jobs default to parallel).
   * An explicit `[]` is the same effective graph result for jobs, but the
   * distinction matters for stages (see StageIR) so it's kept consistent here.
   */
  readonly dependsOn: readonly string[] | undefined;
  readonly condition: string;
  readonly variables: Record<string, string>;
  readonly steps: readonly StepIR[];
  readonly pool?: unknown;
  readonly strategy?: MatrixStrategy;
}

export interface StageIR {
  readonly name: string;
  readonly displayName: string;
  /**
   * `undefined` means `dependsOn` was omitted entirely, which for STAGES
   * means "depends on the immediately preceding stage in file order"
   * (stages default to sequential). An explicit `[]` means "no dependencies,
   * runs immediately in parallel with the first wave" - this distinction is
   * load-bearing and must be preserved through to the DAG engine (src/lib/dag).
   */
  readonly dependsOn: readonly string[] | undefined;
  readonly condition: string;
  readonly variables: Record<string, string>;
  readonly jobs: readonly JobIR[];
}

export interface PipelineIR {
  readonly stages: readonly StageIR[];
}

export interface ResolvedPipeline {
  readonly ir: PipelineIR;
  readonly diagnostics: readonly Diagnostic[];
  /** The entry pipeline's own declared `parameters:` - what Azure's "Run pipeline" dialog would show as runtime parameter controls. */
  readonly parameterDeclarations: readonly ParameterDeclaration[];
}

export const DEFAULT_CONDITION = "succeeded()";
