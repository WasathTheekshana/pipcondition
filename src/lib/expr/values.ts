export interface VersionValue {
  readonly __brand: "version";
  readonly segments: readonly number[];
  readonly raw: string;
}

export type RuntimeValue =
  | boolean
  | null
  | number
  | string
  | VersionValue
  | readonly RuntimeValue[]
  | { readonly [key: string]: RuntimeValue };

export type RuntimeType = "null" | "boolean" | "number" | "version" | "string" | "object";

export function isVersionValue(v: unknown): v is VersionValue {
  return typeof v === "object" && v !== null && (v as VersionValue).__brand === "version";
}

export function makeVersion(raw: string, segments: readonly number[]): VersionValue {
  return { __brand: "version", raw, segments };
}

export function getRuntimeType(v: RuntimeValue): RuntimeType {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (isVersionValue(v)) return "version";
  return "object";
}
