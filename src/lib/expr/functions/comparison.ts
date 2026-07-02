import type { FunctionDefinition } from "../registry";
import type { RuntimeValue } from "../values";
import { valuesEqual, compareOrder } from "../coercion";

// Ordering ops evaluate to false when the operands aren't comparable
// (matches "if conversion fails, the comparison evaluates to false").
function ordered(a: RuntimeValue, b: RuntimeValue, test: (cmp: number) => boolean): boolean {
  const cmp = compareOrder(a, b);
  return cmp === undefined ? false : test(cmp);
}

export const COMPARISON_FUNCTIONS: readonly FunctionDefinition[] = [
  { name: "eq", minArgs: 2, maxArgs: 2, evaluate: ([a, b]) => valuesEqual(a, b) },
  { name: "ne", minArgs: 2, maxArgs: 2, evaluate: ([a, b]) => !valuesEqual(a, b) },
  { name: "gt", minArgs: 2, maxArgs: 2, evaluate: ([a, b]) => ordered(a, b, (cmp) => cmp > 0) },
  { name: "ge", minArgs: 2, maxArgs: 2, evaluate: ([a, b]) => ordered(a, b, (cmp) => cmp >= 0) },
  { name: "lt", minArgs: 2, maxArgs: 2, evaluate: ([a, b]) => ordered(a, b, (cmp) => cmp < 0) },
  { name: "le", minArgs: 2, maxArgs: 2, evaluate: ([a, b]) => ordered(a, b, (cmp) => cmp <= 0) },
];
