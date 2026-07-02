import type { RuntimeValue } from "@/lib/expr/values";
import type { VirtualFileSystem } from "./vfs/types";
import type { Diagnostic, ResolvedPipeline, StageIR } from "./pipeline-ir";
import { resolveRootDocument } from "./resolve-refs";
import { mapStageToIR } from "./map-to-ir";

export interface ResolveOptions {
  /** Top-level parameter overrides, e.g. from the mock-config UI. */
  readonly parameters?: Record<string, unknown>;
  /** Mock variable values used to resolve compile-time `${{ variables.x }}` template expressions. */
  readonly variables?: Record<string, RuntimeValue>;
}

export async function resolvePipeline(entryPath: string, vfs: VirtualFileSystem, options: ResolveOptions = {}): Promise<ResolvedPipeline> {
  const diagnostics: Diagnostic[] = [];
  const rootVariables = options.variables ?? {};

  const { stages: rawStages, rootParameterDeclarations } = await resolveRootDocument(entryPath, options.parameters ?? {}, rootVariables, {
    vfs,
    diagnostics,
    visited: [],
  });

  const stages: StageIR[] = rawStages.map((stage, i) => mapStageToIR(stage, i, diagnostics));
  return { ir: { stages }, diagnostics, parameterDeclarations: rootParameterDeclarations };
}

export type { PipelineIR, StageIR, JobIR, StepIR, Diagnostic, ResolvedPipeline, MatrixStrategy } from "./pipeline-ir";
export { DEFAULT_CONDITION } from "./pipeline-ir";
export type { VirtualFileSystem } from "./vfs/types";
export { createBrowserVfs } from "./vfs/browser-vfs";
export type { ParameterDeclaration } from "./parameters";
