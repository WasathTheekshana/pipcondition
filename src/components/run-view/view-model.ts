import type { PipelineGraph, RunReport, JobReport, StepReport } from "@/lib/dag";
import type { StageIR, JobIR, StepIR } from "@/lib/template/pipeline-ir";

export interface StepVM {
  readonly id: string;
  readonly name: string;
  readonly ir: StepIR;
  readonly report: StepReport;
}

export interface JobVM {
  readonly id: string;
  readonly name: string;
  readonly ir: JobIR;
  readonly report: JobReport;
  readonly steps: readonly StepVM[];
}

export interface StageVM {
  readonly id: string;
  readonly name: string;
  readonly ir: StageIR;
  readonly report: import("@/lib/dag").StageReport;
  readonly jobs: readonly JobVM[];
}

/** Zips the DAG's graph (IR/condition source, structural shape) with its RunReport (computed results) by node id, into one tree the UI can render directly. */
export function buildViewModel(graph: PipelineGraph, report: RunReport): readonly StageVM[] {
  const stageReportById = new Map(report.stages.map((s) => [s.id, s]));

  return graph.stageOrder.map((stageId) => {
    const stageNode = graph.stages.find((s) => s.id === stageId)!;
    const stageReport = stageReportById.get(stageId)!;
    const jobReportById = new Map(stageReport.jobs.map((j) => [j.id, j]));

    const jobs: JobVM[] = (graph.jobOrderByStage[stageId] ?? []).map((jobId) => {
      const jobNode = stageNode.jobs.find((j) => j.id === jobId)!;
      const jobReport = jobReportById.get(jobId)!;
      const stepReportById = new Map(jobReport.steps.map((s) => [s.id, s]));

      const steps: StepVM[] = jobNode.steps.map((stepNode) => ({
        id: stepNode.id,
        name: stepNode.name,
        ir: stepNode.ir,
        report: stepReportById.get(stepNode.id)!,
      }));

      return { id: jobNode.id, name: jobNode.name, ir: jobNode.ir, report: jobReport, steps };
    });

    return { id: stageNode.id, name: stageNode.name, ir: stageNode.ir, report: stageReport, jobs };
  });
}
