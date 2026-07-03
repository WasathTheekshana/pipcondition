import { parseExpression } from "@/lib/expr/parser";
import { lookupFunction } from "@/lib/expr/registry";
import { castToBoolean, castToString } from "@/lib/expr/coercion";
import { createRunContext } from "@/lib/expr/context";
import { ExpressionError } from "@/lib/expr/errors";
import type { ExprNode, PropertyPathSegment, Span } from "@/lib/expr/ast";
import type { RuntimeValue } from "@/lib/expr/values";

/**
 * Compile-time `${{ }}` template expressions share the same function-call
 * grammar as runtime `condition:` expressions (both parsed by
 * src/lib/expr/parser.ts and both use the same function registry), but they
 * resolve properties against a flat, caller-defined scope (parameters,
 * `each` loop variables, etc.) instead of the fixed variables/parameters/
 * dependencies/stageDependencies roots that condition expressions use.
 * Status functions like succeeded()/failed() aren't meaningful at template
 * expansion time (nothing has run yet), so they resolve against an inert
 * default context if a template author mistakenly reaches for them.
 */
export type TemplateScope = Readonly<Record<string, RuntimeValue>>;

const INERT_CONTEXT = createRunContext();

function resolveScopedProperty(path: readonly PropertyPathSegment[], scope: TemplateScope, span: Span): RuntimeValue {
  const [root, ...rest] = path;
  if (root.kind !== "identifier") {
    throw new ExpressionError("Expected a template variable name", span);
  }
  if (!(root.name in scope)) {
    throw new ExpressionError(`Unknown template variable '${root.name}'`, span);
  }

  // Azure variables are always flat strings, and an unset one resolves to ""
  // rather than erroring - real pipelines constantly reference built-in
  // variables (Build.SourceBranch, Build.Reason, ...) inside ${{ if }}
  // blocks that a user testing locally hasn't (and typically wouldn't)
  // mock every single one of. Matches the same leniency the runtime
  // condition engine already applies (see property-resolution.ts).
  if (root.name.toLowerCase() === "variables") {
    return resolveVariableProperty(scope[root.name], rest, scope, span);
  }

  let current: RuntimeValue = scope[root.name];
  const traversed = [root.name];
  for (const seg of rest) {
    const key = seg.kind === "identifier" ? seg.name : castToKeyString(evalNode(seg.expr, scope));
    traversed.push(key);
    if (current === null || typeof current !== "object") {
      throw new ExpressionError(`Cannot read '${key}' of ${traversed.slice(0, -1).join(".")}`, span);
    }
    const next = Array.isArray(current) ? (current as readonly RuntimeValue[])[Number(key)] : (current as Record<string, RuntimeValue>)[key];
    if (next === undefined) {
      throw new ExpressionError(`Unknown property '${traversed.join(".")}'`, span);
    }
    current = next;
  }
  return current;
}

function resolveVariableProperty(variablesValue: RuntimeValue, rest: readonly PropertyPathSegment[], scope: TemplateScope, span: Span): RuntimeValue {
  if (rest.length !== 1) {
    throw new ExpressionError("variables must be accessed as variables['Name'] or variables.name", span);
  }
  const seg = rest[0];
  const key = seg.kind === "identifier" ? seg.name : castToKeyString(evalNode(seg.expr, scope));
  const varsObj = (variablesValue && typeof variablesValue === "object" ? variablesValue : {}) as Record<string, RuntimeValue>;
  const match = Object.keys(varsObj).find((k) => k.toLowerCase() === key.toLowerCase());
  return match === undefined ? "" : varsObj[match];
}

function castToKeyString(v: RuntimeValue): string {
  const cast = castToString(v);
  if (!cast.ok) throw new ExpressionError("Index expression must evaluate to a string");
  return cast.value as string;
}

function evalNode(node: ExprNode, scope: TemplateScope): RuntimeValue {
  switch (node.kind) {
    case "StringLiteral":
    case "NumberLiteral":
    case "BooleanLiteral":
      return node.value;
    case "PropertyAccess":
      return resolveScopedProperty(node.path, scope, node.span);
    case "FunctionCall": {
      const fn = lookupFunction(node.name);
      if (!fn) throw new ExpressionError(`Unknown function '${node.name}'`, node.span);
      const args = node.args.map((arg) => evalNode(arg, scope));
      return fn.evaluate(args, INERT_CONTEXT);
    }
  }
}

export function evaluateTemplateExpression(source: string, scope: TemplateScope): RuntimeValue {
  return evalNode(parseExpression(source), scope);
}

export function evaluateTemplateCondition(source: string, scope: TemplateScope): boolean {
  const cast = castToBoolean(evaluateTemplateExpression(source, scope));
  return cast.ok ? (cast.value as boolean) : false;
}
