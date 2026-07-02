import type { RunContext } from "./context";
import type { RuntimeValue } from "./values";
import { STATUS_FUNCTIONS } from "./functions/status";
import { COMPARISON_FUNCTIONS } from "./functions/comparison";
import { LOGICAL_FUNCTIONS } from "./functions/logical";
import { STRING_FUNCTIONS } from "./functions/string";
import { MEMBERSHIP_FUNCTIONS } from "./functions/membership";
import { COUNTER_FUNCTIONS } from "./functions/counter";

export interface FunctionDefinition {
  readonly name: string;
  readonly minArgs: number;
  /** undefined means unlimited (variadic) */
  readonly maxArgs?: number;
  readonly evaluate: (args: readonly RuntimeValue[], ctx: RunContext) => RuntimeValue;
}

const ALL_FUNCTIONS: readonly FunctionDefinition[] = [
  ...STATUS_FUNCTIONS,
  ...COMPARISON_FUNCTIONS,
  ...LOGICAL_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...MEMBERSHIP_FUNCTIONS,
  ...COUNTER_FUNCTIONS,
];

const REGISTRY = new Map<string, FunctionDefinition>(ALL_FUNCTIONS.map((fn) => [fn.name.toLowerCase(), fn]));

export function lookupFunction(name: string): FunctionDefinition | undefined {
  return REGISTRY.get(name.toLowerCase());
}
