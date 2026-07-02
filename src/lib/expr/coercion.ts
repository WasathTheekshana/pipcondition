import { type RuntimeValue, type RuntimeType, type VersionValue, getRuntimeType, makeVersion } from "./values";

/**
 * Implements the implicit type-conversion rules described in
 * https://learn.microsoft.com/en-us/azure/devops/pipelines/process/expressions#type-casting
 *
 * Do not approximate this table — it is the single highest-risk correctness
 * surface for the whole simulator, since it silently changes what `eq`/`ne`/
 * `gt`/etc. decide.
 */
export type CastResult = { readonly ok: true; readonly value: RuntimeValue } | { readonly ok: false };

const ok = (value: RuntimeValue): CastResult => ({ ok: true, value });
const fail: CastResult = { ok: false };

const NUMERIC_STRING = /^[+-]?\d+(\.\d+)?$/;
const VERSION_STRING = /^\d{1,5}(\.\d{1,5}){1,3}$/;

export function castToBoolean(v: RuntimeValue): CastResult {
  switch (getRuntimeType(v)) {
    case "boolean":
      return ok(v as boolean);
    case "null":
      return ok(false);
    case "number":
      return ok((v as number) !== 0 && !Number.isNaN(v as number));
    case "string":
      return ok((v as string).length > 0);
    case "version":
      return ok(true);
    case "object":
      return ok(true);
  }
}

export function castToNumber(v: RuntimeValue): CastResult {
  switch (getRuntimeType(v)) {
    case "number":
      return ok(v as number);
    case "boolean":
      return ok(v ? 1 : 0);
    case "null":
      return ok(0);
    case "string": {
      const s = (v as string).trim();
      if (!NUMERIC_STRING.test(s)) return fail;
      return ok(Number(s));
    }
    case "version":
    case "object":
      return fail;
  }
}

function parseVersionString(raw: string): VersionValue | undefined {
  const s = raw.trim();
  if (!VERSION_STRING.test(s)) return undefined;
  const segments = s.split(".").map((part) => Number(part));
  if (segments.some((n) => n > 65535)) return undefined;
  return makeVersion(s, segments);
}

export function castToVersion(v: RuntimeValue): CastResult {
  switch (getRuntimeType(v)) {
    case "version":
      return ok(v as VersionValue);
    case "string": {
      const parsed = parseVersionString(v as string);
      return parsed ? ok(parsed) : fail;
    }
    case "number": {
      const parsed = parseVersionString(formatNumber(v as number));
      return parsed ? ok(parsed) : fail;
    }
    case "boolean":
    case "null":
    case "object":
      return fail;
  }
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toString();
}

export function castToString(v: RuntimeValue): CastResult {
  switch (getRuntimeType(v)) {
    case "string":
      return ok(v as string);
    case "boolean":
      return ok(v ? "True" : "False");
    case "null":
      return ok("");
    case "number":
      return ok(formatNumber(v as number));
    case "version":
      return ok((v as VersionValue).raw);
    case "object":
      return fail;
  }
}

export function castToObject(v: RuntimeValue): CastResult {
  return getRuntimeType(v) === "object" ? ok(v) : fail;
}

export function castToNull(v: RuntimeValue): CastResult {
  return getRuntimeType(v) === "null" ? ok(null) : fail;
}

export function castTo(v: RuntimeValue, type: RuntimeType): CastResult {
  switch (type) {
    case "boolean":
      return castToBoolean(v);
    case "number":
      return castToNumber(v);
    case "version":
      return castToVersion(v);
    case "string":
      return castToString(v);
    case "object":
      return castToObject(v);
    case "null":
      return castToNull(v);
  }
}

function compareVersions(a: VersionValue, b: VersionValue): number {
  const len = Math.max(a.segments.length, b.segments.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.segments[i] ?? 0) - (b.segments[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * eq/ne semantics: "the left operand's type wins; the right operand is
 * converted to match it. If conversion fails, the comparison is false."
 * For object/array left operands, comparison recurses per-property/per-item
 * using the same left-wins rule (matches the documented array/object
 * conversion behavior for eq()).
 */
export function valuesEqual(left: RuntimeValue, right: RuntimeValue): boolean {
  const leftType = getRuntimeType(left);
  const rightCast = castTo(right, leftType);
  if (!rightCast.ok) return false;
  const rightValue = rightCast.value;

  switch (leftType) {
    case "null":
      return true;
    case "boolean":
      return (left as boolean) === (rightValue as boolean);
    case "number":
      return (left as number) === (rightValue as number);
    case "string":
      return (left as string).toLowerCase() === (rightValue as string).toLowerCase();
    case "version":
      return compareVersions(left as VersionValue, rightValue as VersionValue) === 0;
    case "object":
      return objectsEqual(left, rightValue);
  }
}

function objectsEqual(left: RuntimeValue, right: RuntimeValue): boolean {
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, i) => valuesEqual(item, (right as readonly RuntimeValue[])[i]));
  }
  if (Array.isArray(right)) return false;
  const leftObj = left as { readonly [key: string]: RuntimeValue };
  const rightObj = right as { readonly [key: string]: RuntimeValue };
  const leftKeys = Object.keys(leftObj);
  if (leftKeys.length !== Object.keys(rightObj).length) return false;
  return leftKeys.every((key) => key in rightObj && valuesEqual(leftObj[key], rightObj[key]));
}

/**
 * Ordering (gt/ge/lt/le): same left-wins cast rule. Returns undefined when
 * the values are not ordering-comparable (e.g. objects, or failed casts),
 * which callers treat as `false` for every ordering operator.
 */
export function compareOrder(left: RuntimeValue, right: RuntimeValue): number | undefined {
  const leftType = getRuntimeType(left);
  const rightCast = castTo(right, leftType);
  if (!rightCast.ok) return undefined;
  const rightValue = rightCast.value;

  switch (leftType) {
    case "number":
      return (left as number) - (rightValue as number);
    case "version":
      return compareVersions(left as VersionValue, rightValue as VersionValue);
    case "string": {
      const a = (left as string).toLowerCase();
      const b = (rightValue as string).toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    }
    case "boolean":
      return (left ? 1 : 0) - (rightValue ? 1 : 0);
    case "null":
    case "object":
      return undefined;
  }
}
