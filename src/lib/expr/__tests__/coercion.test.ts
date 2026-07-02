import { describe, expect, it } from "vitest";
import { castToBoolean, castToNumber, castToVersion, castToString, castToObject, castToNull, valuesEqual, compareOrder } from "../coercion";
import { makeVersion } from "../values";

describe("castToBoolean", () => {
  it("null -> false", () => expect(castToBoolean(null)).toEqual({ ok: true, value: false }));
  it("0 -> false, non-zero -> true", () => {
    expect(castToBoolean(0)).toEqual({ ok: true, value: false });
    expect(castToBoolean(NaN)).toEqual({ ok: true, value: false });
    expect(castToBoolean(1)).toEqual({ ok: true, value: true });
    expect(castToBoolean(-1)).toEqual({ ok: true, value: true });
  });
  it("empty string -> false, non-empty -> true", () => {
    expect(castToBoolean("")).toEqual({ ok: true, value: false });
    expect(castToBoolean("false")).toEqual({ ok: true, value: true });
  });
  it("objects and arrays are always true", () => {
    expect(castToBoolean({})).toEqual({ ok: true, value: true });
    expect(castToBoolean([])).toEqual({ ok: true, value: true });
  });
  it("version is always true", () => {
    expect(castToBoolean(makeVersion("1.0", [1, 0]))).toEqual({ ok: true, value: true });
  });
});

describe("castToNumber", () => {
  it("booleans convert to 1/0", () => {
    expect(castToNumber(true)).toEqual({ ok: true, value: 1 });
    expect(castToNumber(false)).toEqual({ ok: true, value: 0 });
  });
  it("null converts to 0", () => expect(castToNumber(null)).toEqual({ ok: true, value: 0 }));
  it("well-formed numeric strings convert", () => {
    expect(castToNumber("42")).toEqual({ ok: true, value: 42 });
    expect(castToNumber("-3.5")).toEqual({ ok: true, value: -3.5 });
    expect(castToNumber("  10  ")).toEqual({ ok: true, value: 10 });
  });
  it("non-numeric strings fail", () => {
    expect(castToNumber("abc")).toEqual({ ok: false });
    expect(castToNumber("")).toEqual({ ok: false });
    expect(castToNumber("1.2.3")).toEqual({ ok: false });
  });
  it("versions and objects cannot become numbers", () => {
    expect(castToNumber(makeVersion("1.0", [1, 0])).ok).toBe(false);
    expect(castToNumber({}).ok).toBe(false);
  });
});

describe("castToVersion", () => {
  it("parses well-formed version strings", () => {
    const result = castToVersion("1.2.3");
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.value as { segments: number[] }).segments).toEqual([1, 2, 3]);
  });
  it("rejects single-segment strings", () => {
    expect(castToVersion("1").ok).toBe(false);
  });
  it("rejects out-of-range segments", () => {
    expect(castToVersion("1.99999").ok).toBe(false);
  });
  it("numbers convert via their string form", () => {
    // 1.5 -> "1.5" -> version [1,5]
    expect(castToVersion(1.5)).toEqual({ ok: true, value: makeVersion("1.5", [1, 5]) });
  });
  it("booleans, null, and objects cannot become versions", () => {
    expect(castToVersion(true).ok).toBe(false);
    expect(castToVersion(null).ok).toBe(false);
    expect(castToVersion({}).ok).toBe(false);
  });
});

describe("castToString", () => {
  it("booleans -> 'True'/'False'", () => {
    expect(castToString(true)).toEqual({ ok: true, value: "True" });
    expect(castToString(false)).toEqual({ ok: true, value: "False" });
  });
  it("null -> empty string", () => expect(castToString(null)).toEqual({ ok: true, value: "" }));
  it("numbers format without unnecessary decoration", () => {
    expect(castToString(42)).toEqual({ ok: true, value: "42" });
    expect(castToString(1.5)).toEqual({ ok: true, value: "1.5" });
  });
  it("version -> its raw string", () => {
    expect(castToString(makeVersion("1.2.3", [1, 2, 3]))).toEqual({ ok: true, value: "1.2.3" });
  });
  it("objects cannot be stringified", () => {
    expect(castToString({}).ok).toBe(false);
    expect(castToString([]).ok).toBe(false);
  });
});

describe("castToObject / castToNull", () => {
  it("only objects/arrays cast to object", () => {
    expect(castToObject({ a: 1 }).ok).toBe(true);
    expect(castToObject([1, 2]).ok).toBe(true);
    expect(castToObject("x").ok).toBe(false);
  });
  it("only null casts to null", () => {
    expect(castToNull(null)).toEqual({ ok: true, value: null });
    expect(castToNull("").ok).toBe(false);
    expect(castToNull(0).ok).toBe(false);
  });
});

describe("valuesEqual (left-operand-wins casting)", () => {
  it("string comparisons are case-insensitive", () => {
    expect(valuesEqual("Foo", "foo")).toBe(true);
    expect(valuesEqual("foo", "bar")).toBe(false);
  });
  it("casts right operand to left operand's type", () => {
    expect(valuesEqual(1, "1")).toBe(true); // left=number -> right "1" casts to 1
    expect(valuesEqual("1", 1)).toBe(true); // left=string -> right 1 casts to "1"
  });
  it("string->boolean casts on emptiness only, not content (a real Azure gotcha)", () => {
    // Any non-empty string casts to boolean true, regardless of its text -
    // so eq(true, 'false') is actually TRUE in Azure Pipelines expressions.
    expect(valuesEqual(true, "false")).toBe(true);
    expect(valuesEqual(true, "")).toBe(false);
  });
  it("boolean equality", () => {
    expect(valuesEqual(true, true)).toBe(true);
    expect(valuesEqual(true, false)).toBe(false);
  });
  it("failed right-side casts evaluate to not-equal", () => {
    expect(valuesEqual(1, "abc")).toBe(false);
    expect(valuesEqual({}, "x")).toBe(false);
  });
  it("null only equals null/undefined-like", () => {
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, "")).toBe(false); // "" is a string, not null, and can't cast string->null
  });
  it("versions compare numerically per segment, not lexicographically", () => {
    expect(valuesEqual(makeVersion("1.9", [1, 9]), "1.9")).toBe(true);
    expect(valuesEqual(makeVersion("1.10", [1, 10]), makeVersion("1.9", [1, 9]))).toBe(false);
  });
  it("arrays compare element-wise", () => {
    expect(valuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(valuesEqual([1, 2], [1, 2, 3])).toBe(false);
  });
  it("plain objects compare by matching keys/values", () => {
    expect(valuesEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("compareOrder", () => {
  it("orders numbers", () => {
    expect(compareOrder(1, 2)).toBeLessThan(0);
    expect(compareOrder(2, 1)).toBeGreaterThan(0);
    expect(compareOrder(1, 1)).toBe(0);
  });
  it("orders strings case-insensitively", () => {
    expect(compareOrder("a", "B")).toBeLessThan(0);
  });
  it("orders versions by numeric segment, not string", () => {
    expect(compareOrder(makeVersion("1.9", [1, 9]), makeVersion("1.10", [1, 10]))).toBeLessThan(0);
  });
  it("returns undefined for incomparable object operands", () => {
    expect(compareOrder({}, {})).toBeUndefined();
  });
});
