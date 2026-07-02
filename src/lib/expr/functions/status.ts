import type { FunctionDefinition } from "../registry";
import type { Result } from "../context";
import type { RuntimeValue } from "../values";
import { castToString } from "../coercion";
import { ExpressionError } from "../errors";

function isSuccessLike(result: Result): boolean {
  return result === "Succeeded" || result === "SucceededWithIssues";
}

function isSuccessOrFailure(result: Result): boolean {
  return result === "Succeeded" || result === "SucceededWithIssues" || result === "Failed";
}

function namesFromArgs(args: readonly RuntimeValue[]): string[] {
  return args.map((arg) => {
    const cast = castToString(arg);
    if (!cast.ok) throw new ExpressionError("Dependency name arguments must be strings");
    return cast.value as string;
  });
}

export const STATUS_FUNCTIONS: readonly FunctionDefinition[] = [
  {
    name: "succeeded",
    minArgs: 0,
    evaluate: (args, ctx) => {
      if (args.length === 0) return isSuccessLike(ctx.aggregateStatus);
      return namesFromArgs(args).every((name) => {
        const dep = ctx.dependencies[name];
        if (!dep) throw new ExpressionError(`Unknown dependency '${name}' in succeeded()`);
        return isSuccessLike(dep.result);
      });
    },
  },
  {
    name: "failed",
    minArgs: 0,
    evaluate: (args, ctx) => {
      if (args.length === 0) return ctx.aggregateStatus === "Failed";
      return namesFromArgs(args).some((name) => {
        const dep = ctx.dependencies[name];
        if (!dep) throw new ExpressionError(`Unknown dependency '${name}' in failed()`);
        return dep.result === "Failed";
      });
    },
  },
  {
    name: "canceled",
    minArgs: 0,
    maxArgs: 0,
    evaluate: (_args, ctx) => ctx.aggregateStatus === "Canceled",
  },
  {
    name: "succeededorfailed",
    minArgs: 0,
    evaluate: (args, ctx) => {
      if (args.length === 0) return isSuccessOrFailure(ctx.aggregateStatus);
      return namesFromArgs(args).every((name) => {
        const dep = ctx.dependencies[name];
        if (!dep) throw new ExpressionError(`Unknown dependency '${name}' in succeededOrFailed()`);
        return isSuccessOrFailure(dep.result);
      });
    },
  },
  {
    name: "always",
    minArgs: 0,
    maxArgs: 0,
    evaluate: () => true,
  },
];
