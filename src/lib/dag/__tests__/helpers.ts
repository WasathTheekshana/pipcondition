import type { PipelineIR, StageIR, JobIR, StepIR } from "@/lib/template/pipeline-ir";
import { DEFAULT_CONDITION } from "@/lib/template/pipeline-ir";

export function step(overrides: Partial<StepIR> & { readonly name: string }): StepIR {
  return {
    displayName: overrides.name,
    condition: DEFAULT_CONDITION,
    continueOnError: false,
    enabled: true,
    kind: "script",
    raw: {},
    ...overrides,
  };
}

export function job(overrides: Partial<JobIR> & { readonly name: string }): JobIR {
  return {
    displayName: overrides.name,
    dependsOn: undefined,
    condition: DEFAULT_CONDITION,
    variables: {},
    steps: [],
    ...overrides,
  };
}

export function stage(overrides: Partial<StageIR> & { readonly name: string }): StageIR {
  return {
    displayName: overrides.name,
    dependsOn: undefined,
    condition: DEFAULT_CONDITION,
    variables: {},
    jobs: [],
    ...overrides,
  };
}

export function pipeline(stages: readonly StageIR[]): PipelineIR {
  return { stages };
}
