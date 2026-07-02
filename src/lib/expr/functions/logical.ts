import type { FunctionDefinition } from "../registry";
import type { RuntimeValue } from "../values";
import { castToBoolean } from "../coercion";

// castToBoolean never fails (every RuntimeType has a boolean coercion), so
// this is a plain unwrap rather than error-handling.
function bool(v: RuntimeValue): boolean {
  const cast = castToBoolean(v);
  return cast.ok && (cast.value as boolean);
}

export const LOGICAL_FUNCTIONS: readonly FunctionDefinition[] = [
  {
    // and()/or() must evaluate every argument (not JS && / || short-circuit),
    // since arguments can have side effects such as counter().
    name: "and",
    minArgs: 2,
    evaluate: (args) => args.map(bool).every(Boolean),
  },
  {
    name: "or",
    minArgs: 2,
    evaluate: (args) => args.map(bool).some(Boolean),
  },
  {
    name: "not",
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([a]) => !bool(a),
  },
  {
    name: "xor",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([a, b]) => bool(a) !== bool(b),
  },
];
