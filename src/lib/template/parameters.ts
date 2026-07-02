import type { Diagnostic } from "./pipeline-ir";

export interface ParameterDeclaration {
  readonly name: string;
  readonly type: string;
  readonly default?: unknown;
  readonly values?: readonly unknown[];
}

const LIST_TYPES = new Set(["object", "stepList", "jobList", "stageList", "deploymentList"]);
const STRUCTURAL_TYPES = new Set(["step", "job", "stage", "deployment"]);

export function parseParameterDeclarations(raw: unknown): ParameterDeclaration[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      name: String(entry.name ?? ""),
      type: typeof entry.type === "string" ? entry.type : "string",
      default: entry.default,
      values: Array.isArray(entry.values) ? entry.values : undefined,
    }))
    .filter((decl) => decl.name.length > 0);
}

function typeDefaultFallback(type: string): unknown {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (LIST_TYPES.has(type) || type.endsWith("List")) return [];
  if (STRUCTURAL_TYPES.has(type)) return {};
  return "";
}

function typeMatches(type: string, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null;
    default:
      if (LIST_TYPES.has(type) || type.endsWith("List")) return Array.isArray(value);
      if (STRUCTURAL_TYPES.has(type)) return typeof value === "object" && value !== null;
      return true;
  }
}

/**
 * Resolves the effective `parameters.*` context for one file, merging
 * caller-provided values with declared defaults, and validating `values:`
 * allow-lists. Deviations are collected as diagnostics rather than thrown,
 * so the simulator can still show a best-effort run for a slightly
 * malformed pipeline (more useful for a debugging tool than an all-or-nothing parser).
 */
export function resolveParameterValues(
  declarations: readonly ParameterDeclaration[],
  provided: Readonly<Record<string, unknown>>,
  pathPrefix: string,
  diagnostics: Diagnostic[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const decl of declarations) {
    const hasProvided = Object.prototype.hasOwnProperty.call(provided, decl.name);
    let value = hasProvided ? provided[decl.name] : decl.default;

    if (value === undefined) {
      diagnostics.push({
        severity: "error",
        message: `Missing required parameter '${decl.name}' and no default was given`,
        path: pathPrefix,
      });
      value = typeDefaultFallback(decl.type);
    }

    if (decl.values && decl.values.length > 0 && !decl.values.some((allowed) => JSON.stringify(allowed) === JSON.stringify(value))) {
      diagnostics.push({
        severity: "error",
        message: `Parameter '${decl.name}' value ${JSON.stringify(value)} is not one of the allowed values ${JSON.stringify(decl.values)}`,
        path: pathPrefix,
      });
    }

    if (!typeMatches(decl.type, value)) {
      diagnostics.push({
        severity: "warning",
        message: `Parameter '${decl.name}' expected type '${decl.type}' but got ${typeof value}`,
        path: pathPrefix,
      });
    }

    result[decl.name] = value;
  }

  for (const key of Object.keys(provided)) {
    if (!declarations.some((decl) => decl.name === key)) {
      diagnostics.push({ severity: "warning", message: `Parameter '${key}' was provided but not declared`, path: pathPrefix });
      result[key] = provided[key];
    }
  }

  return result;
}
