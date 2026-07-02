import type { Result } from "@/lib/expr/context";
import type { TraceNode } from "@/lib/expr/format-tree";

export type SkippedReason = "condition-false" | "dependency-skipped" | "dependency-failed-no-override" | "not-selected" | undefined;

export interface StepReport {
  readonly id: string;
  readonly name: string;
  readonly result: Result;
  readonly conditionResult: boolean;
  readonly conditionTrace: TraceNode;
  readonly skippedReason: SkippedReason;
}

export interface JobReport {
  readonly id: string;
  readonly name: string;
  readonly result: Result;
  readonly conditionResult: boolean;
  readonly conditionTrace: TraceNode;
  readonly skippedReason: SkippedReason;
  readonly steps: readonly StepReport[];
}

export interface StageReport {
  readonly id: string;
  readonly name: string;
  readonly result: Result;
  readonly conditionResult: boolean;
  readonly conditionTrace: TraceNode;
  readonly skippedReason: SkippedReason;
  readonly jobs: readonly JobReport[];
}

export interface RunReport {
  readonly stages: readonly StageReport[];
}
