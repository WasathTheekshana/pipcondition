import type { ExprNode, PropertyPathSegment, Span } from "./ast";
import type { RunContext, DependencyRecord } from "./context";
import type { RuntimeValue } from "./values";
import { castToString } from "./coercion";
import { ExpressionError } from "./errors";

export type EvaluateFn = (node: ExprNode, ctx: RunContext) => RuntimeValue;

function segmentKey(seg: PropertyPathSegment, ctx: RunContext, evaluate: EvaluateFn): string {
  if (seg.kind === "identifier") return seg.name;
  const value = evaluate(seg.expr, ctx);
  const cast = castToString(value);
  if (!cast.ok) {
    throw new ExpressionError("Index expression must evaluate to a string");
  }
  return cast.value as string;
}

function resolveVariable(name: string, ctx: RunContext): RuntimeValue {
  const match = Object.keys(ctx.variables).find((key) => key.toLowerCase() === name.toLowerCase());
  // Azure treats an unset variable as an empty string rather than an error.
  return match === undefined ? "" : ctx.variables[match];
}

function resolveParameterPath(segments: readonly PropertyPathSegment[], ctx: RunContext, evaluate: EvaluateFn, span: Span): RuntimeValue {
  const [first, ...rest] = segments;
  const rootName = segmentKey(first, ctx, evaluate);
  const match = Object.keys(ctx.parameters).find((key) => key.toLowerCase() === rootName.toLowerCase());
  if (match === undefined) {
    throw new ExpressionError(`Unknown parameter '${rootName}'`, span);
  }
  let current: RuntimeValue = ctx.parameters[match];
  const path = [rootName];
  for (const seg of rest) {
    const key = segmentKey(seg, ctx, evaluate);
    path.push(key);
    if (current === null || typeof current !== "object") {
      throw new ExpressionError(`Cannot read '${key}' of parameters.${path.slice(0, -1).join(".")}`, span);
    }
    const next = Array.isArray(current)
      ? (current as readonly RuntimeValue[])[Number(key)]
      : (current as { readonly [k: string]: RuntimeValue })[key];
    if (next === undefined) {
      throw new ExpressionError(`Unknown property 'parameters.${path.join(".")}'`, span);
    }
    current = next;
  }
  return current;
}

function resolveDependencyRecord(record: DependencyRecord | undefined, name: string, rest: readonly PropertyPathSegment[], ctx: RunContext, evaluate: EvaluateFn, span: Span): RuntimeValue {
  if (!record) {
    throw new ExpressionError(`Unknown dependency '${name}'`, span);
  }
  if (rest.length === 0) {
    throw new ExpressionError(`dependencies.${name} must be followed by '.result' or '.outputs[...]'`, span);
  }
  const [accessor, ...remainder] = rest;
  const accessorName = segmentKey(accessor, ctx, evaluate);

  if (accessorName.toLowerCase() === "result") {
    return record.result;
  }
  if (accessorName.toLowerCase() === "outputs") {
    if (remainder.length === 0) {
      throw new ExpressionError(`dependencies.${name}.outputs must be indexed by a variable key`, span);
    }
    const key = remainder.map((seg) => segmentKey(seg, ctx, evaluate)).join(".");
    const value = record.outputs[key];
    return value === undefined ? "" : value;
  }
  throw new ExpressionError(`Unknown property 'dependencies.${name}.${accessorName}'`, span);
}

export function resolveProperty(path: readonly PropertyPathSegment[], ctx: RunContext, evaluate: EvaluateFn, span: Span): RuntimeValue {
  const [root, ...rest] = path;
  if (root.kind !== "identifier") {
    throw new ExpressionError("Expression must start with a context name (variables, parameters, dependencies, stageDependencies)", span);
  }

  switch (root.name.toLowerCase()) {
    case "variables": {
      if (rest.length !== 1) {
        throw new ExpressionError("variables must be accessed as variables['Name'] or variables.name", span);
      }
      return resolveVariable(segmentKey(rest[0], ctx, evaluate), ctx);
    }
    case "parameters": {
      if (rest.length === 0) {
        throw new ExpressionError("parameters must be accessed as parameters['name'] or parameters.name", span);
      }
      return resolveParameterPath(rest, ctx, evaluate, span);
    }
    case "dependencies": {
      if (rest.length === 0) {
        throw new ExpressionError("dependencies must be accessed as dependencies.<name>.result or dependencies.<name>.outputs[...]", span);
      }
      const [nameSeg, ...remainder] = rest;
      const name = segmentKey(nameSeg, ctx, evaluate);
      return resolveDependencyRecord(ctx.dependencies[name], name, remainder, ctx, evaluate, span);
    }
    case "stagedependencies": {
      if (rest.length < 2) {
        throw new ExpressionError("stageDependencies must be accessed as stageDependencies.<stage>.<job>.result or .outputs[...]", span);
      }
      const [stageSeg, jobSeg, ...remainder] = rest;
      const stageName = segmentKey(stageSeg, ctx, evaluate);
      const jobName = segmentKey(jobSeg, ctx, evaluate);
      const stageJobs = ctx.stageDependencies[stageName];
      return resolveDependencyRecord(stageJobs?.[jobName], `${stageName}.${jobName}`, remainder, ctx, evaluate, span);
    }
    default:
      throw new ExpressionError(`Unknown context '${root.name}'`, span);
  }
}
