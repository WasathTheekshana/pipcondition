import { parse as parseYaml, YAMLParseError } from "yaml";
import type { RuntimeValue } from "@/lib/expr/values";
import type { VirtualFileSystem } from "./vfs/types";
import type { Diagnostic } from "./pipeline-ir";
import { expandValue } from "./expand";
import { normalizeToStages } from "./normalize";
import { parseParameterDeclarations, resolveParameterValues, type ParameterDeclaration } from "./parameters";
import { normalizeVariables } from "./map-to-ir";
import { splitTemplateRef, resolveTemplatePath } from "./path-utils";
import type { TemplateScope } from "./template-expr";

const MAX_DEPTH = 50;

export interface ResolveContext {
  readonly vfs: VirtualFileSystem;
  readonly diagnostics: Diagnostic[];
  /** Stack of file paths currently being resolved, for relative-path joining and cycle detection. */
  readonly visited: readonly string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isTemplateRef(item: unknown): item is { readonly template: string; readonly parameters?: Record<string, unknown> } {
  return isPlainObject(item) && typeof item.template === "string";
}

/** YAML-parsed data is plain JSON-shaped data, which is always assignable to RuntimeValue; this documents that boundary in one place instead of scattering `as unknown as RuntimeValue` casts. */
function asRuntimeValue(v: unknown): RuntimeValue {
  return v as RuntimeValue;
}

async function loadAndParseYaml(path: string, ctx: ResolveContext): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await ctx.vfs.readFile(path);
  } catch {
    ctx.diagnostics.push({ severity: "error", message: `Could not read '${path}' (file not found)`, path });
    return {};
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (err) {
    // YAMLParseError's own .message is a multi-line block with a source
    // excerpt and a "^" caret - useful in a terminal, noisy in a diagnostics
    // list. Keep just its first line for the message and surface the real
    // line number separately so the editor can underline the exact spot.
    const line = err instanceof YAMLParseError ? err.linePos?.[0]?.line : undefined;
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    ctx.diagnostics.push({ severity: "error", message: `Failed to parse YAML in '${path}': ${message}`, path, line });
    return {};
  }
  if (!isPlainObject(parsed)) {
    ctx.diagnostics.push({ severity: "error", message: `${path} did not parse to a YAML mapping at its root`, path });
    return {};
  }
  return parsed;
}

function pushVisited(ctx: ResolveContext, path: string): ResolveContext {
  return { ...ctx, visited: [...ctx.visited, path] };
}

function checkDepthAndCycles(path: string, ctx: ResolveContext): boolean {
  if (ctx.visited.includes(path)) {
    ctx.diagnostics.push({
      severity: "error",
      message: `Circular template reference: ${[...ctx.visited, path].join(" -> ")}`,
      path,
    });
    return false;
  }
  if (ctx.visited.length >= MAX_DEPTH) {
    ctx.diagnostics.push({ severity: "error", message: `Template resolution exceeded max depth (${MAX_DEPTH})`, path });
    return false;
  }
  return true;
}

/** Loads one template file, resolves its own parameters, and expands its `${{ }}` constructs. Does not recurse into nested template refs - callers do that with the right list-level context. */
async function loadExpandedTemplate(
  resolvedPath: string,
  providedParams: Record<string, unknown>,
  rootVariables: Readonly<Record<string, RuntimeValue>>,
  ctx: ResolveContext,
): Promise<{ readonly expanded: Record<string, unknown>; readonly nestedCtx: ResolveContext }> {
  const raw = await loadAndParseYaml(resolvedPath, ctx);
  const nestedCtx = pushVisited(ctx, resolvedPath);
  const declarations = parseParameterDeclarations(raw.parameters);
  const paramValues = resolveParameterValues(declarations, providedParams, resolvedPath, nestedCtx.diagnostics as Diagnostic[]);
  const scope: TemplateScope = { parameters: asRuntimeValue(paramValues), variables: asRuntimeValue(rootVariables) };
  const expanded = expandValue(raw, scope) as Record<string, unknown>;
  return { expanded, nestedCtx };
}

async function resolveTemplateList(
  templateRef: string,
  listKey: "stages" | "jobs" | "steps",
  providedParams: Record<string, unknown>,
  rootVariables: Readonly<Record<string, RuntimeValue>>,
  ctx: ResolveContext,
): Promise<{ readonly list: unknown[]; readonly nestedCtx: ResolveContext }> {
  const { path: relPath, repoAlias } = splitTemplateRef(templateRef);
  if (repoAlias && repoAlias.toLowerCase() !== "self") {
    ctx.diagnostics.push({
      severity: "warning",
      message: `Template reference '${templateRef}' targets repository '@${repoAlias}', which this local simulator can't check out; treated as empty`,
      path: templateRef,
    });
    return { list: [], nestedCtx: ctx };
  }

  const currentFile = ctx.visited[ctx.visited.length - 1] ?? "";
  const resolvedPath = resolveTemplatePath(currentFile, relPath);

  if (!checkDepthAndCycles(resolvedPath, ctx)) return { list: [], nestedCtx: ctx };

  const { expanded, nestedCtx } = await loadExpandedTemplate(resolvedPath, providedParams, rootVariables, ctx);
  const list = expanded[listKey];
  if (!Array.isArray(list)) {
    nestedCtx.diagnostics.push({
      severity: "error",
      message: `Template '${resolvedPath}' does not define a top-level '${listKey}:' list`,
      path: resolvedPath,
    });
    return { list: [], nestedCtx };
  }
  return { list, nestedCtx };
}

async function resolveStepsArray(rawSteps: readonly unknown[], rootVariables: Readonly<Record<string, RuntimeValue>>, ctx: ResolveContext): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (const item of rawSteps) {
    if (isTemplateRef(item)) {
      const { list, nestedCtx } = await resolveTemplateList(item.template, "steps", item.parameters ?? {}, rootVariables, ctx);
      result.push(...(await resolveStepsArray(list, rootVariables, nestedCtx)));
      continue;
    }
    if (isPlainObject(item)) result.push(item);
  }
  return result;
}

async function resolveJobsArray(rawJobs: readonly unknown[], rootVariables: Readonly<Record<string, RuntimeValue>>, ctx: ResolveContext): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (const item of rawJobs) {
    if (isTemplateRef(item)) {
      const { list, nestedCtx } = await resolveTemplateList(item.template, "jobs", item.parameters ?? {}, rootVariables, ctx);
      result.push(...(await resolveJobsArray(list, rootVariables, nestedCtx)));
      continue;
    }
    if (!isPlainObject(item)) continue;
    const steps = Array.isArray(item.steps) ? await resolveStepsArray(item.steps, rootVariables, ctx) : [];
    result.push({ ...item, steps });
  }
  return result;
}

async function resolveStagesArray(rawStages: readonly unknown[], rootVariables: Readonly<Record<string, RuntimeValue>>, ctx: ResolveContext): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  for (const item of rawStages) {
    if (isTemplateRef(item)) {
      const { list, nestedCtx } = await resolveTemplateList(item.template, "stages", item.parameters ?? {}, rootVariables, ctx);
      result.push(...(await resolveStagesArray(list, rootVariables, nestedCtx)));
      continue;
    }
    if (!isPlainObject(item)) continue;
    const jobs = Array.isArray(item.jobs) ? await resolveJobsArray(item.jobs, rootVariables, ctx) : [];
    result.push({ ...item, jobs });
  }
  return result;
}

export interface RootResolution {
  readonly stages: Record<string, unknown>[];
  /** The entry pipeline's own declared `parameters:` block - not the base template's, when `extends:` is used. */
  readonly rootParameterDeclarations: readonly ParameterDeclaration[];
  /** Declared defaults merged with caller-provided overrides - what `parameters.*` resolves to both at compile time and, via the DAG engine, at runtime in `condition:` expressions. */
  readonly rootParameterValues: Record<string, unknown>;
  /** The pipeline-level `variables:` block, flattened - cascades down to every stage as a base layer. */
  readonly pipelineVariables: Readonly<Record<string, string>>;
}

/** Resolves `extends: { template, parameters }` by delegating entirely to the base template as the pipeline's root document. Returns the base template's stages/variables plus the *extending* file's own declarations/values, which are what's user-facing. */
async function resolveExtends(
  path: string,
  raw: Record<string, unknown>,
  providedParams: Record<string, unknown>,
  rootVariables: Readonly<Record<string, RuntimeValue>>,
  ctx: ResolveContext,
): Promise<RootResolution> {
  const extendsBlock = raw.extends as Record<string, unknown>;
  const templateRef = typeof extendsBlock.template === "string" ? extendsBlock.template : "";

  const ownDeclarations = parseParameterDeclarations(raw.parameters);
  const nestedCtx = pushVisited(ctx, path);
  const ownParamValues = resolveParameterValues(ownDeclarations, providedParams, path, nestedCtx.diagnostics as Diagnostic[]);
  const ownScope: TemplateScope = { parameters: asRuntimeValue(ownParamValues), variables: asRuntimeValue(rootVariables) };
  const passedParams = expandValue(extendsBlock.parameters ?? {}, ownScope) as Record<string, unknown>;

  const { path: relPath, repoAlias } = splitTemplateRef(templateRef);
  if (repoAlias && repoAlias.toLowerCase() !== "self") {
    nestedCtx.diagnostics.push({ severity: "warning", message: `extends template '@${repoAlias}' is not resolvable in this simulator`, path });
    return { stages: [], pipelineVariables: {}, rootParameterDeclarations: ownDeclarations, rootParameterValues: ownParamValues };
  }
  const resolvedPath = resolveTemplatePath(path, relPath);
  if (!checkDepthAndCycles(resolvedPath, nestedCtx)) {
    return { stages: [], pipelineVariables: {}, rootParameterDeclarations: ownDeclarations, rootParameterValues: ownParamValues };
  }

  const inner = await resolveRootDocument(resolvedPath, passedParams, rootVariables, nestedCtx);
  return { stages: inner.stages, pipelineVariables: inner.pipelineVariables, rootParameterDeclarations: ownDeclarations, rootParameterValues: ownParamValues };
}

export async function resolveRootDocument(
  path: string,
  providedParams: Record<string, unknown>,
  rootVariables: Readonly<Record<string, RuntimeValue>>,
  ctx: ResolveContext,
): Promise<RootResolution> {
  const raw = await loadAndParseYaml(path, ctx);

  if (isPlainObject(raw.extends)) {
    return resolveExtends(path, raw, providedParams, rootVariables, ctx);
  }

  const nestedCtx = pushVisited(ctx, path);
  const declarations = parseParameterDeclarations(raw.parameters);
  const paramValues = resolveParameterValues(declarations, providedParams, path, nestedCtx.diagnostics as Diagnostic[]);
  const scope: TemplateScope = { parameters: asRuntimeValue(paramValues), variables: asRuntimeValue(rootVariables) };

  const expanded = expandValue(raw, scope) as Record<string, unknown>;
  const pipelineVariables = normalizeVariables(expanded.variables, nestedCtx.diagnostics as Diagnostic[], path);
  const rawStages = normalizeToStages(expanded);
  const stages = await resolveStagesArray(rawStages, rootVariables, nestedCtx);
  return { stages, rootParameterDeclarations: declarations, rootParameterValues: paramValues, pipelineVariables };
}
