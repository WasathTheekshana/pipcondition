import type { FunctionDefinition } from "../registry";
import type { RuntimeValue } from "../values";
import { castToString, castToObject } from "../coercion";
import { getRuntimeType } from "../values";
import { ExpressionError } from "../errors";

function str(v: RuntimeValue): string {
  const cast = castToString(v);
  if (!cast.ok) return "";
  return (cast.value as string).toLowerCase();
}

function rawStr(v: RuntimeValue): string {
  const cast = castToString(v);
  if (!cast.ok) throw new ExpressionError("Expected a value convertible to string");
  return cast.value as string;
}

function elementsOf(v: RuntimeValue): readonly RuntimeValue[] {
  const cast = castToObject(v);
  if (!cast.ok) throw new ExpressionError("Expected an array or object value");
  const obj = cast.value;
  return Array.isArray(obj) ? obj : Object.values(obj as { readonly [k: string]: RuntimeValue });
}

export const STRING_FUNCTIONS: readonly FunctionDefinition[] = [
  {
    // contains(haystack, needle): case-insensitive substring test.
    name: "contains",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([haystack, needle]) => str(haystack).includes(str(needle)),
  },
  {
    name: "startswith",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([haystack, needle]) => str(haystack).startsWith(str(needle)),
  },
  {
    name: "endswith",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([haystack, needle]) => str(haystack).endsWith(str(needle)),
  },
  {
    name: "join",
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([separator, array]) => elementsOf(array).map(rawStr).join(rawStr(separator)),
  },
  {
    name: "format",
    minArgs: 1,
    evaluate: ([template, ...args]) => {
      const templateStr = rawStr(template);
      return templateStr.replace(/\{(\d+)\}/g, (match, indexText: string) => {
        const index = Number(indexText);
        return index < args.length ? rawStr(args[index]) : match;
      });
    },
  },
  {
    name: "coalesce",
    minArgs: 1,
    evaluate: (args) => {
      for (const arg of args) {
        if (getRuntimeType(arg) === "null") continue;
        if (getRuntimeType(arg) === "string" && arg === "") continue;
        return arg;
      }
      return null;
    },
  },
  {
    name: "length",
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([value]) => {
      const type = getRuntimeType(value);
      if (type === "string") return (value as string).length;
      if (type === "object") return elementsOf(value).length;
      return 0;
    },
  },
];
