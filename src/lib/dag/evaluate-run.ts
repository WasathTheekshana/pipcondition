import type { Result, RunContext, DependencyRecord } from "@/lib/expr/context";
import { createRunContext } from "@/lib/expr/context";
import { evaluateConditionSource } from "@/lib/expr";
import type { RuntimeValue } from "@/lib/expr/values";
import type { PipelineGraph, JobNode, StepNode } from "./build-graph";
import { aggregateStatus, rollupResults } from "./status";
import type { RunInputs, MockOutcome } from "./mock-outcomes";
import type { RunReport, StageReport, JobReport, StepReport, SkippedReason } from "./report";

function resolveOverride(nodeId: string, computed: Result, inputs: RunInputs): Result {
  const override: MockOutcome | undefined = inputs.outcomeOverrides?.[nodeId];
  return override && override !== "inherit" ? override : computed;
}

function skippedReasonFor(dependencyResults: readonly Result[]): SkippedReason {
  if (dependencyResults.some((r) => r === "Skipped")) return "dependency-skipped";
  if (dependencyResults.some((r) => r === "Failed" || r === "Canceled")) return "dependency-failed-no-override";
  return "condition-false";
}

function asRuntimeRecord(v: Readonly<Record<string, unknown>> | undefined): Record<string, RuntimeValue> {
  return (v ?? {}) as Record<string, RuntimeValue>;
}

interface JobEvalResult {
  readonly report: JobReport;
  readonly result: Result;
  /** Keyed "stepName.varName", for exposure as dependencies.<jobName>.outputs / stageDependencies.<stage>.<job>.outputs. */
  readonly outputs: Record<string, string>;
}

function evaluateStep(
  step: StepNode,
  precedingStepResults: readonly Result[],
  jobDependencies: Record<string, DependencyRecord>,
  jobStageDependencies: Record<string, Record<string, DependencyRecord>>,
  variables: Record<string, string>,
  rootParameters: Record<string, unknown>,
  inputs: RunInputs,
  counters: Map<string, number>,
): { readonly report: StepReport; readonly result: Result } {
  const aggregate = aggregateStatus(precedingStepResults);
  const ctx: RunContext = createRunContext({
    variables: variables as Record<string, RuntimeValue>,
    parameters: asRuntimeRecord(rootParameters),
    dependencies: jobDependencies,
    stageDependencies: jobStageDependencies,
    aggregateStatus: aggregate,
    counters,
  });

  const { result: conditionResult, trace } = evaluateConditionSource(step.ir.condition, ctx);

  let result: Result;
  let skippedReason: SkippedReason;
  if (!conditionResult) {
    result = "Skipped";
    skippedReason = skippedReasonFor(precedingStepResults);
  } else {
    result = resolveOverride(step.id, "Succeeded", inputs);
  }

  return {
    report: { id: step.id, name: step.name, result, conditionResult, conditionTrace: trace, skippedReason },
    result,
  };
}

function evaluateJob(
  job: JobNode,
  stageDependencies: Record<string, Record<string, DependencyRecord>>,
  jobDependencyResults: Map<string, Result>,
  jobDependencyOutputs: Map<string, Record<string, string>>,
  variables: Record<string, string>,
  rootParameters: Record<string, unknown>,
  inputs: RunInputs,
  counters: Map<string, number>,
): JobEvalResult {
  const localDeps = job.ir.dependsOn ?? [];
  const dependencies: Record<string, DependencyRecord> = {};
  for (const depName of localDeps) {
    dependencies[depName] = {
      result: jobDependencyResults.get(depName) ?? "NotStarted",
      outputs: jobDependencyOutputs.get(depName) ?? {},
    };
  }

  const aggregate = aggregateStatus(localDeps.map((d) => dependencies[d].result));
  const ctx: RunContext = createRunContext({
    variables: variables as Record<string, RuntimeValue>,
    parameters: asRuntimeRecord(rootParameters),
    dependencies,
    stageDependencies,
    aggregateStatus: aggregate,
    counters,
  });

  const { result: conditionResult, trace } = evaluateConditionSource(job.ir.condition, ctx);

  if (!conditionResult) {
    const result = "Skipped" as const;
    const steps: StepReport[] = job.steps.map((step) => ({
      id: step.id,
      name: step.name,
      result: "Skipped",
      conditionResult: false,
      conditionTrace: trace,
      skippedReason: "dependency-skipped",
    }));
    return {
      report: { id: job.id, name: job.name, result, conditionResult, conditionTrace: trace, skippedReason: skippedReasonFor(localDeps.map((d) => dependencies[d].result)), steps },
      result,
      outputs: {},
    };
  }

  const stepReports: StepReport[] = [];
  const stepResults: Result[] = [];
  const stepAllowFailure: boolean[] = [];
  const outputs: Record<string, string> = {};

  for (const step of job.steps) {
    const { report, result } = evaluateStep(step, stepResults, dependencies, stageDependencies, variables, rootParameters, inputs, counters);
    stepReports.push(report);
    stepResults.push(result);
    stepAllowFailure.push(step.ir.continueOnError);

    const declaredOutputs = inputs.stepOutputs?.[step.id];
    if (declaredOutputs) {
      for (const [varName, value] of Object.entries(declaredOutputs)) {
        outputs[`${step.name}.${varName}`] = value;
      }
    }
  }

  const computed = rollupResults(stepResults, stepAllowFailure);
  const result = resolveOverride(job.id, computed, inputs);

  return {
    report: { id: job.id, name: job.name, result, conditionResult, conditionTrace: trace, skippedReason: undefined, steps: stepReports },
    result,
    outputs,
  };
}

export function simulateRun(graph: PipelineGraph, inputs: RunInputs): RunReport {
  const rootVariables = (inputs.variables ?? {}) as Record<string, string>;
  const rootParameters = (inputs.parameters ?? {}) as Record<string, unknown>;
  const counters = new Map<string, number>();

  const stageResults = new Map<string, Result>();
  // Keyed "jobName.stepName.varName" - for dependencies.<stageName>.outputs (cross-stage, stage-to-stage).
  const stageFlatOutputs = new Map<string, Record<string, string>>();
  // Keyed by job's local declared name -> ("stepName.varName" -> value) - for stageDependencies.<stageName>.<jobName>.outputs.
  const stageJobOutputs = new Map<string, Record<string, Record<string, string>>>();

  const stageReports: StageReport[] = [];
  const stageById = new Map(graph.stages.map((s) => [s.id, s]));

  for (const stageId of graph.stageOrder) {
    const stage = stageById.get(stageId)!;

    const dependencies: Record<string, DependencyRecord> = {};
    for (const depName of stage.dependsOn) {
      dependencies[depName] = {
        result: stageResults.get(depName) ?? "NotStarted",
        outputs: stageFlatOutputs.get(depName) ?? {},
      };
    }
    const stageDependenciesForJobs: Record<string, Record<string, DependencyRecord>> = {};
    for (const depName of stage.dependsOn) {
      const jobOutputsForDep = stageJobOutputs.get(depName) ?? {};
      const perJob: Record<string, DependencyRecord> = {};
      for (const [jobName, jobOutputs] of Object.entries(jobOutputsForDep)) {
        perJob[jobName] = { result: stageResults.get(depName) ?? "NotStarted", outputs: jobOutputs };
      }
      stageDependenciesForJobs[depName] = perJob;
    }

    const aggregate = aggregateStatus(stage.dependsOn.map((d) => dependencies[d].result));
    const stageVariables = { ...rootVariables, ...stage.ir.variables };
    const ctx: RunContext = createRunContext({
      variables: stageVariables as Record<string, RuntimeValue>,
      parameters: asRuntimeRecord(rootParameters),
      dependencies,
      stageDependencies: stageDependenciesForJobs,
      aggregateStatus: aggregate,
      counters,
    });
    const { result: naturalConditionResult, trace } = evaluateConditionSource(stage.ir.condition, ctx);
    // A stage deselected via "stages to run" is excluded from consideration
    // entirely, before its own condition is allowed to matter - the trace is
    // still computed above purely for display ("here's what it would have
    // evaluated to"), but the run decision itself is forced.
    const isExcluded = inputs.excludedStages?.includes(stage.id) ?? false;
    const conditionResult = isExcluded ? false : naturalConditionResult;

    let jobReports: JobReport[];
    let stageResult: Result;
    let skippedReason: SkippedReason;
    const jobOutputsThisStage: Record<string, Record<string, string>> = {};

    if (!conditionResult) {
      stageResult = "Skipped";
      skippedReason = isExcluded ? "not-selected" : skippedReasonFor(stage.dependsOn.map((d) => dependencies[d].result));
      jobReports = stage.jobs.map((job) => ({
        id: job.id,
        name: job.name,
        result: "Skipped",
        conditionResult: false,
        conditionTrace: trace,
        skippedReason: "dependency-skipped",
        steps: job.steps.map((step) => ({
          id: step.id,
          name: step.name,
          result: "Skipped" as const,
          conditionResult: false,
          conditionTrace: trace,
          skippedReason: "dependency-skipped" as const,
        })),
      }));
    } else {
      const jobResults = new Map<string, Result>();
      const jobOutputs = new Map<string, Record<string, string>>();
      jobReports = [];
      for (const jobId of graph.jobOrderByStage[stage.id] ?? []) {
        const job = stage.jobs.find((j) => j.id === jobId)!;
        const evalResult = evaluateJob(job, stageDependenciesForJobs, jobResults, jobOutputs, stageVariables, rootParameters, inputs, counters);
        jobResults.set(job.name, evalResult.result);
        jobOutputs.set(job.name, evalResult.outputs);
        jobOutputsThisStage[job.name] = evalResult.outputs;
        jobReports.push(evalResult.report);
      }
      const computed = rollupResults(jobReports.map((r) => r.result));
      stageResult = resolveOverride(stage.id, computed, inputs);
      skippedReason = undefined;
    }

    stageResults.set(stage.id, stageResult);
    stageJobOutputs.set(stage.id, jobOutputsThisStage);
    const flat: Record<string, string> = {};
    for (const [jobName, jobOut] of Object.entries(jobOutputsThisStage)) {
      for (const [key, value] of Object.entries(jobOut)) {
        flat[`${jobName}.${key}`] = value;
      }
    }
    stageFlatOutputs.set(stage.id, flat);

    stageReports.push({ id: stage.id, name: stage.name, result: stageResult, conditionResult, conditionTrace: trace, skippedReason, jobs: jobReports });
  }

  return { stages: stageReports };
}
