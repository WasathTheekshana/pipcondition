import type { PipelineIR, Diagnostic } from "@/lib/template/pipeline-ir";
import { buildGraph } from "./build-graph";
import { simulateRun } from "./evaluate-run";
import type { RunInputs } from "./mock-outcomes";
import type { RunReport } from "./report";

export function runSimulation(ir: PipelineIR, inputs: RunInputs = {}): { readonly report: RunReport; readonly diagnostics: readonly Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const graph = buildGraph(ir, diagnostics);
  const report = simulateRun(graph, inputs);
  return { report, diagnostics };
}

export type { PipelineGraph, StageNode, JobNode, StepNode } from "./build-graph";
export { buildGraph } from "./build-graph";
export type { RunInputs, MockOutcome } from "./mock-outcomes";
export type { RunReport, StageReport, JobReport, StepReport, SkippedReason } from "./report";
export { simulateRun } from "./evaluate-run";
export { aggregateStatus, rollupResults } from "./status";
