import type { PipelineIR, StageIR, JobIR, StepIR, Diagnostic } from "@/lib/template/pipeline-ir";
import { topologicalOrder } from "./topo-order";

export interface StepNode {
  readonly id: string;
  readonly name: string;
  readonly jobId: string;
  readonly index: number;
  readonly ir: StepIR;
}

export interface JobNode {
  readonly id: string;
  readonly name: string;
  readonly stageId: string;
  /** Job node ids (same stage only - cross-stage data flows only through dependencies./stageDependencies. expressions, never a graph edge). */
  readonly dependsOn: readonly string[];
  readonly ir: JobIR;
  readonly steps: readonly StepNode[];
}

export interface StageNode {
  readonly id: string;
  readonly name: string;
  readonly dependsOn: readonly string[];
  readonly ir: StageIR;
  readonly jobs: readonly JobNode[];
}

export interface PipelineGraph {
  readonly stages: readonly StageNode[];
  readonly stageOrder: readonly string[];
  readonly jobOrderByStage: Readonly<Record<string, readonly string[]>>;
}

// Scope decision: `strategy.matrix` fan-out (one job node per matrix leg) is
// not implemented. It's a real Azure feature, but expanding it correctly
// (including how dependency aggregation across legs would work) is a
// significant chunk of additional complexity that isn't central to the
// condition/dependsOn testing this tool is built for. A job with a matrix
// strategy is represented as a single node; `ir.strategy` is preserved on
// JobIR so the UI can at least display that a matrix was declared.

function resolveStageDependsOn(stage: StageIR, index: number, allStages: readonly StageIR[]): readonly string[] {
  if (stage.dependsOn !== undefined) return stage.dependsOn;
  return index === 0 ? [] : [allStages[index - 1].name];
}

export function buildGraph(ir: PipelineIR, diagnostics: Diagnostic[]): PipelineGraph {
  const stageNames = new Set(ir.stages.map((s) => s.name));

  const stages: StageNode[] = ir.stages.map((stage, index) => {
    const dependsOn = resolveStageDependsOn(stage, index, ir.stages);
    for (const dep of dependsOn) {
      if (!stageNames.has(dep)) {
        diagnostics.push({ severity: "error", message: `Stage '${stage.name}' depends on unknown stage '${dep}'`, path: `stages[${index}]` });
      }
    }

    const jobNames = new Set(stage.jobs.map((j) => j.name));
    const jobs: JobNode[] = stage.jobs.map((job, jobIndex) => {
      // Jobs default to PARALLEL (no implicit dependency) when dependsOn is omitted - unlike stages.
      const jobDependsOn = job.dependsOn ?? [];
      for (const dep of jobDependsOn) {
        if (!jobNames.has(dep)) {
          diagnostics.push({ severity: "error", message: `Job '${job.name}' in stage '${stage.name}' depends on unknown job '${dep}'`, path: `stages[${index}].jobs[${jobIndex}]` });
        }
      }

      const steps: StepNode[] = job.steps.map((step, stepIndex) => ({
        id: `${stage.name}/${job.name}/${step.name}#${stepIndex}`,
        name: step.name,
        jobId: `${stage.name}/${job.name}`,
        index: stepIndex,
        ir: step,
      }));

      return {
        id: `${stage.name}/${job.name}`,
        name: job.name,
        stageId: stage.name,
        dependsOn: jobDependsOn.map((dep) => `${stage.name}/${dep}`),
        ir: job,
        steps,
      };
    });

    return { id: stage.name, name: stage.name, dependsOn, ir: stage, jobs };
  });

  const stageOrderResult = topologicalOrder(
    stages.map((s) => s.id),
    (id) => stages.find((s) => s.id === id)?.dependsOn ?? [],
  );
  if (stageOrderResult.cycle) {
    diagnostics.push({ severity: "error", message: "Cycle detected among stage dependsOn relationships", path: "stages" });
  }

  const jobOrderByStage: Record<string, readonly string[]> = {};
  for (const stage of stages) {
    const jobIds = stage.jobs.map((j) => j.id);
    const result = topologicalOrder(
      jobIds,
      (id) => stage.jobs.find((j) => j.id === id)?.dependsOn ?? [],
    );
    if (result.cycle) {
      diagnostics.push({ severity: "error", message: `Cycle detected among job dependsOn relationships in stage '${stage.name}'`, path: `stages[${stage.name}].jobs` });
    }
    jobOrderByStage[stage.id] = result.order;
  }

  return { stages, stageOrder: stageOrderResult.order, jobOrderByStage };
}
