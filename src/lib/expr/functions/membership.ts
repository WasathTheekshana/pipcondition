import type { FunctionDefinition } from "../registry";
import type { RuntimeValue } from "../values";
import { valuesEqual, castToObject } from "../coercion";
import { ExpressionError } from "../errors";

export const MEMBERSHIP_FUNCTIONS: readonly FunctionDefinition[] = [
  {
    name: "in",
    minArgs: 1,
    evaluate: ([needle, ...rest]) => rest.some((item) => valuesEqual(needle, item)),
  },
  {
    name: "notin",
    minArgs: 1,
    evaluate: ([needle, ...rest]) => !rest.some((item) => valuesEqual(needle, item)),
  },
  {
    name: "containsvalue",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([collection, value]) => {
      const cast = castToObject(collection);
      if (!cast.ok) throw new ExpressionError("containsValue's first argument must be an object or array");
      const obj = cast.value;
      const elements: readonly RuntimeValue[] = Array.isArray(obj) ? obj : Object.values(obj as { readonly [k: string]: RuntimeValue });
      return elements.some((element) => valuesEqual(value, element));
    },
  },
];
