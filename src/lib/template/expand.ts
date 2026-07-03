import { castToString } from "@/lib/expr/coercion";
import type { RuntimeValue } from "@/lib/expr/values";
import { evaluateTemplateExpression, evaluateTemplateCondition, type TemplateScope } from "./template-expr";

type ControlKey =
  | { readonly kind: "if"; readonly condition: string }
  | { readonly kind: "elseif"; readonly condition: string }
  | { readonly kind: "else" }
  | { readonly kind: "each"; readonly varName: string; readonly inExpr: string }
  | { readonly kind: "insert" };

const IF_RE = /^\$\{\{\s*if\s+([\s\S]+?)\s*\}\}$/;
const ELSEIF_RE = /^\$\{\{\s*elseif\s+([\s\S]+?)\s*\}\}$/;
const ELSE_RE = /^\$\{\{\s*else\s*\}\}$/;
const EACH_RE = /^\$\{\{\s*each\s+(\w+)\s+in\s+([\s\S]+?)\s*\}\}$/;
const INSERT_RE = /^\$\{\{\s*insert\s*\}\}$/;
const LEADING_EXPR_RE = /^\$\{\{([\s\S]+?)\}\}/;

/**
 * A string that is *entirely* a single `${{ }}` expression (once trimmed)
 * gets type-preserving substitution (the result can be a number/bool/array,
 * not just a string). Anything else - including a string with more than one
 * `${{ }}` occurrence, e.g. '${{ parameters.environment }}-${{ region.name }}'
 * - is plain string concatenation instead. A naive greedy `^\$\{\{(.+)\}\}$`
 * regex would swallow the literal text and second expression between two
 * such occurrences as if they were one expression body and fail to parse -
 * this checks that the *first* `${{ ... }}` occurrence's closing `}}` is
 * also the end of the string before treating it as a whole match.
 */
function matchSingleWholeExpr(trimmed: string): string | undefined {
  const leading = trimmed.match(LEADING_EXPR_RE);
  if (!leading || leading[0].length !== trimmed.length) return undefined;
  return leading[1].trim();
}
const EMBEDDED_EXPR_RE = /\$\{\{([\s\S]*?)\}\}/g;

function matchControlKey(key: string): ControlKey | undefined {
  let m = key.match(IF_RE);
  if (m) return { kind: "if", condition: m[1] };
  m = key.match(ELSEIF_RE);
  if (m) return { kind: "elseif", condition: m[1] };
  if (ELSE_RE.test(key)) return { kind: "else" };
  m = key.match(EACH_RE);
  if (m) return { kind: "each", varName: m[1], inExpr: m[2] };
  if (INSERT_RE.test(key)) return { kind: "insert" };
  return undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function iterableElements(value: RuntimeValue): readonly RuntimeValue[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") return Object.values(value as Record<string, RuntimeValue>);
  return [];
}

/** Object keys can themselves contain `${{ }}` substitutions (e.g. dynamic variable names generated inside `each`), which always resolve to a string regardless of the referenced value's type. */
function expandKeyString(key: string, scope: TemplateScope): string {
  if (!key.includes("${{")) return key;
  return key.replace(EMBEDDED_EXPR_RE, (_match, inner: string) => {
    const value = evaluateTemplateExpression(inner.trim(), scope);
    const cast = castToString(value);
    return cast.ok ? (cast.value as string) : "";
  });
}

function expandString(s: string, scope: TemplateScope): unknown {
  if (!s.includes("${{")) return s;
  const whole = matchSingleWholeExpr(s.trim());
  if (whole !== undefined) return evaluateTemplateExpression(whole, scope);
  return s.replace(EMBEDDED_EXPR_RE, (_match, inner: string) => {
    const value = evaluateTemplateExpression(inner.trim(), scope);
    const cast = castToString(value);
    return cast.ok ? (cast.value as string) : "";
  });
}

/** Evaluates an if/elseif/else branch chain starting at `startIndex`, returning the chosen value and next index. */
function resolveIfChain<T>(
  entries: readonly T[],
  startIndex: number,
  scope: TemplateScope,
  getControlKey: (entry: T) => ControlKey | undefined,
  getValue: (entry: T) => unknown,
): { readonly chosen: unknown; readonly nextIndex: number } {
  const first = getControlKey(entries[startIndex]);
  if (!first || first.kind !== "if") throw new Error("resolveIfChain called on a non-if entry");

  const branches: { readonly condition?: string; readonly value: unknown }[] = [{ condition: first.condition, value: getValue(entries[startIndex]) }];
  let i = startIndex + 1;
  while (i < entries.length) {
    const control = getControlKey(entries[i]);
    if (control?.kind === "elseif") {
      branches.push({ condition: control.condition, value: getValue(entries[i]) });
      i++;
      continue;
    }
    if (control?.kind === "else") {
      branches.push({ value: getValue(entries[i]) });
      i++;
    }
    break;
  }

  const chosen = branches.find((b) => b.condition === undefined || evaluateTemplateCondition(b.condition, scope));
  return { chosen: chosen?.value, nextIndex: i };
}

function expandObject(obj: Record<string, unknown>, scope: TemplateScope): unknown {
  const keys = Object.keys(obj);
  const result: Record<string, unknown> = {};
  let i = 0;

  const mergeIfObject = (value: unknown, withScope: TemplateScope = scope) => {
    if (value === undefined) return;
    const expanded = expandValue(value, withScope);
    if (isPlainObject(expanded)) Object.assign(result, expanded);
  };

  while (i < keys.length) {
    const key = keys[i];
    const control = matchControlKey(key);

    if (control?.kind === "if") {
      const { chosen, nextIndex } = resolveIfChain(
        keys,
        i,
        scope,
        (k) => matchControlKey(k),
        (k) => obj[k],
      );
      mergeIfObject(chosen);
      i = nextIndex;
      continue;
    }
    if (control?.kind === "each") {
      const iterable = evaluateTemplateExpression(control.inExpr, scope);
      for (const item of iterableElements(iterable)) {
        const nestedScope = { ...scope, [control.varName]: item };
        mergeIfObject(obj[key], nestedScope);
      }
      i++;
      continue;
    }
    if (control?.kind === "insert") {
      mergeIfObject(obj[key]);
      i++;
      continue;
    }
    if (control?.kind === "elseif" || control?.kind === "else") {
      // Orphaned elseif/else (no preceding if) - skip defensively rather than crash.
      i++;
      continue;
    }

    result[expandKeyString(key, scope)] = expandValue(obj[key], scope);
    i++;
  }

  return result;
}

function expandArray(arr: readonly unknown[], scope: TemplateScope): unknown[] {
  const result: unknown[] = [];
  let i = 0;

  const singleKeyControl = (item: unknown): { readonly control: ControlKey; readonly rawKey: string } | undefined => {
    if (!isPlainObject(item)) return undefined;
    const keys = Object.keys(item);
    if (keys.length !== 1) return undefined;
    const control = matchControlKey(keys[0]);
    return control ? { control, rawKey: keys[0] } : undefined;
  };

  const pushExpanded = (value: unknown, withScope: TemplateScope = scope) => {
    if (value === undefined) return;
    const expanded = expandValue(value, withScope);
    if (Array.isArray(expanded)) result.push(...expanded);
    else result.push(expanded);
  };

  while (i < arr.length) {
    const item = arr[i];
    const found = singleKeyControl(item);

    if (found?.control.kind === "if") {
      const { chosen, nextIndex } = resolveIfChain(
        arr,
        i,
        scope,
        (entry) => {
          const f = singleKeyControl(entry);
          return f?.control;
        },
        (entry) => (entry as Record<string, unknown>)[singleKeyControl(entry)!.rawKey],
      );
      pushExpanded(chosen);
      i = nextIndex;
      continue;
    }
    if (found?.control.kind === "each") {
      const control = found.control;
      const iterable = evaluateTemplateExpression(control.inExpr, scope);
      for (const el of iterableElements(iterable)) {
        const nestedScope = { ...scope, [control.varName]: el };
        pushExpanded((item as Record<string, unknown>)[found.rawKey], nestedScope);
      }
      i++;
      continue;
    }
    if (found?.control.kind === "insert") {
      pushExpanded((item as Record<string, unknown>)[found.rawKey]);
      i++;
      continue;
    }
    if (found?.control.kind === "elseif" || found?.control.kind === "else") {
      i++;
      continue;
    }

    pushExpanded(item);
    i++;
  }

  return result;
}

export function expandValue(value: unknown, scope: TemplateScope): unknown {
  if (typeof value === "string") return expandString(value, scope);
  if (Array.isArray(value)) return expandArray(value, scope);
  if (isPlainObject(value)) return expandObject(value, scope);
  return value;
}
