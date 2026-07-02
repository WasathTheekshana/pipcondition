import type { ExprNode } from "./ast";
import type { RunContext } from "./context";
import type { RuntimeValue } from "./values";
import { castToBoolean } from "./coercion";
import { lookupFunction, type FunctionDefinition } from "./registry";
import { resolveProperty, type EvaluateFn } from "./property-resolution";
import { ExpressionError } from "./errors";
import type { TraceNode } from "./format-tree";

function describeArity(fn: FunctionDefinition): string {
  if (fn.maxArgs === undefined) return `at least ${fn.minArgs}`;
  if (fn.maxArgs === fn.minArgs) return `exactly ${fn.minArgs}`;
  return `${fn.minArgs}-${fn.maxArgs}`;
}

// Single-pass recursive evaluator that also builds the trace tree, so
// side-effecting functions (counter()) run exactly once per node.
function evalTraced(node: ExprNode, ctx: RunContext): TraceNode {
  switch (node.kind) {
    case "StringLiteral":
    case "NumberLiteral":
    case "BooleanLiteral":
      return { node, value: node.value, children: [] };

    case "PropertyAccess": {
      const evaluateFn: EvaluateFn = (n, c) => evalTraced(n, c).value;
      const value = resolveProperty(node.path, ctx, evaluateFn, node.span);
      return { node, value, children: [] };
    }

    case "FunctionCall": {
      const fn = lookupFunction(node.name);
      if (!fn) {
        throw new ExpressionError(`Unknown function '${node.name}'`, node.span);
      }
      if (node.args.length < fn.minArgs || (fn.maxArgs !== undefined && node.args.length > fn.maxArgs)) {
        throw new ExpressionError(
          `'${node.name}' expects ${describeArity(fn)} argument(s), got ${node.args.length}`,
          node.span,
        );
      }
      const argTraces = node.args.map((arg) => evalTraced(arg, ctx));
      const value = fn.evaluate(
        argTraces.map((t) => t.value),
        ctx,
      );
      return { node, value, children: argTraces };
    }
  }
}

export function evaluateExpression(node: ExprNode, ctx: RunContext): RuntimeValue {
  return evalTraced(node, ctx).value;
}

export function evaluateExpressionTraced(node: ExprNode, ctx: RunContext): TraceNode {
  return evalTraced(node, ctx);
}

export interface ConditionResult {
  readonly result: boolean;
  readonly trace: TraceNode;
}

/** Azure coerces a condition's final value to boolean; a value that can't be coerced (never happens for our castToBoolean) is treated as false. */
export function evaluateCondition(node: ExprNode, ctx: RunContext): ConditionResult {
  const trace = evalTraced(node, ctx);
  const cast = castToBoolean(trace.value);
  return { result: cast.ok ? (cast.value as boolean) : false, trace };
}
