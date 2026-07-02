import type { Diagnostic, JobIR, MatrixStrategy, StageIR, StepIR } from "./pipeline-ir";
import { DEFAULT_CONDITION } from "./pipeline-ir";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `undefined` (omitted) vs an explicit array is load-bearing - see StageIR/JobIR doc comments. */
function normalizeDependsOn(raw: unknown): readonly string[] | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return undefined;
}

function normalizeVariables(raw: unknown): Record<string, string> {
  if (!isPlainObject(raw)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = typeof value === "string" ? value : JSON.stringify(value ?? "");
  }
  return result;
}

function normalizeStrategy(raw: unknown): MatrixStrategy | undefined {
  if (!isPlainObject(raw) || !isPlainObject(raw.matrix)) return undefined;
  const matrix: Record<string, Record<string, string>> = {};
  for (const [legName, legValue] of Object.entries(raw.matrix)) {
    if (isPlainObject(legValue)) matrix[legName] = normalizeVariables(legValue);
  }
  const maxParallel = typeof raw.maxParallel === "number" ? raw.maxParallel : undefined;
  return { matrix, maxParallel };
}

function stepKind(raw: Record<string, unknown>): StepIR["kind"] {
  if (typeof raw.script === "string" || typeof raw.bash === "string" || typeof raw.pwsh === "string" || typeof raw.powershell === "string") return "script";
  if (typeof raw.task === "string") return "task";
  if (typeof raw.checkout === "string") return "checkout";
  return "unknown";
}

function stepName(raw: Record<string, unknown>, index: number): string {
  if (typeof raw.name === "string") return raw.name;
  if (typeof raw.task === "string") return raw.task.split("@")[0];
  if (typeof raw.script === "string") return `script${index}`;
  if (typeof raw.checkout === "string") return `checkout${index}`;
  return `step${index}`;
}

export function mapStepToIR(raw: Record<string, unknown>, index: number): StepIR {
  return {
    name: stepName(raw, index),
    displayName: typeof raw.displayName === "string" ? raw.displayName : stepName(raw, index),
    condition: typeof raw.condition === "string" ? raw.condition : DEFAULT_CONDITION,
    continueOnError: raw.continueOnError === true,
    enabled: raw.enabled !== false,
    kind: stepKind(raw),
    raw,
  };
}

export function mapJobToIR(raw: Record<string, unknown>, index: number, diagnostics: Diagnostic[], path: string): JobIR {
  const name = typeof raw.job === "string" ? raw.job : typeof raw.deployment === "string" ? raw.deployment : `Job${index}`;
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  if (!Array.isArray(raw.steps)) {
    diagnostics.push({ severity: "warning", message: `Job '${name}' has no 'steps:' list`, path: `${path}.jobs[${index}]` });
  }
  return {
    name,
    displayName: typeof raw.displayName === "string" ? raw.displayName : name,
    dependsOn: normalizeDependsOn(raw.dependsOn),
    condition: typeof raw.condition === "string" ? raw.condition : DEFAULT_CONDITION,
    variables: normalizeVariables(raw.variables),
    steps: steps.filter(isPlainObject).map((s, i) => mapStepToIR(s, i)),
    pool: raw.pool,
    strategy: normalizeStrategy(raw.strategy),
  };
}

export function mapStageToIR(raw: Record<string, unknown>, index: number, diagnostics: Diagnostic[]): StageIR {
  const name = typeof raw.stage === "string" ? raw.stage : `Stage${index}`;
  const jobs = Array.isArray(raw.jobs) ? raw.jobs : [];
  if (!Array.isArray(raw.jobs)) {
    diagnostics.push({ severity: "warning", message: `Stage '${name}' has no 'jobs:' list`, path: `stages[${index}]` });
  }
  return {
    name,
    displayName: typeof raw.displayName === "string" ? raw.displayName : name,
    dependsOn: normalizeDependsOn(raw.dependsOn),
    condition: typeof raw.condition === "string" ? raw.condition : DEFAULT_CONDITION,
    variables: normalizeVariables(raw.variables),
    jobs: jobs.filter(isPlainObject).map((j, i) => mapJobToIR(j, i, diagnostics, `stages[${index}]`)),
  };
}
