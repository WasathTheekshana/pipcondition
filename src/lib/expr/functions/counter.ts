import type { FunctionDefinition } from "../registry";
import { castToString, castToNumber } from "../coercion";
import { ExpressionError } from "../errors";

/**
 * Real Azure Pipelines counters persist across pipeline runs on the server.
 * This simulator has no run-history backend, so counter() is approximated
 * as persisting only for the duration of one simulated run (context.counters
 * is a Map shared by every expression evaluated within that run) — the first
 * evaluation for a given prefix returns `seed`, subsequent ones increment.
 */
export const COUNTER_FUNCTIONS: readonly FunctionDefinition[] = [
  {
    name: "counter",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([prefixValue, seedValue], ctx) => {
      const prefixCast = castToString(prefixValue);
      const seedCast = castToNumber(seedValue);
      if (!prefixCast.ok || !seedCast.ok) {
        throw new ExpressionError("counter(prefix, seed) requires a string prefix and numeric seed");
      }
      const prefix = prefixCast.value as string;
      const seed = seedCast.value as number;
      const existing = ctx.counters.get(prefix);
      const next = existing === undefined ? seed : existing + 1;
      ctx.counters.set(prefix, next);
      return next;
    },
  },
];
