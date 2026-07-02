export type { ExprNode, PropertyPathSegment, Span } from "./ast";
export { parseExpression } from "./parser";
export { ExpressionError } from "./errors";
export type { RuntimeValue, RuntimeType, VersionValue } from "./values";
export { getRuntimeType, isVersionValue } from "./values";
export type { RunContext, DependencyRecord, Result } from "./context";
export { createRunContext } from "./context";
export { evaluateExpression, evaluateExpressionTraced, evaluateCondition, type ConditionResult } from "./evaluate";
export type { TraceNode } from "./format-tree";
export { formatTrace } from "./format-tree";
export { lookupFunction, type FunctionDefinition } from "./registry";

import { parseExpression } from "./parser";
import { evaluateCondition, type ConditionResult } from "./evaluate";
import type { RunContext } from "./context";

/** The default condition when a stage/job/step omits `condition:` entirely. */
export const DEFAULT_CONDITION_SOURCE = "succeeded()";

/** Parses and evaluates a `condition:` expression string against a run context. */
export function evaluateConditionSource(source: string, ctx: RunContext): ConditionResult {
  const node = parseExpression(source);
  return evaluateCondition(node, ctx);
}
