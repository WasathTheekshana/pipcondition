import { describe, expect, it } from "vitest";
import { parseExpression } from "../parser";
import { evaluateExpression } from "../evaluate";
import { createRunContext } from "../context";

function evalStr(source: string, overrides: Parameters<typeof createRunContext>[0] = {}) {
  return evaluateExpression(parseExpression(source), createRunContext(overrides));
}

describe("comparison functions", () => {
  it("gt/ge/lt/le on numbers", () => {
    expect(evalStr("gt(2, 1)")).toBe(true);
    expect(evalStr("ge(1, 1)")).toBe(true);
    expect(evalStr("lt(1, 2)")).toBe(true);
    expect(evalStr("le(1, 1)")).toBe(true);
    expect(evalStr("gt(1, 2)")).toBe(false);
  });

  it("string ordering is case-insensitive lexicographic", () => {
    expect(evalStr("lt('apple', 'Banana')")).toBe(true);
  });
});

describe("logical functions", () => {
  it("and/or/not/xor", () => {
    expect(evalStr("and(true, true)")).toBe(true);
    expect(evalStr("and(true, false)")).toBe(false);
    expect(evalStr("or(false, true)")).toBe(true);
    expect(evalStr("not(false)")).toBe(true);
    expect(evalStr("xor(true, false)")).toBe(true);
    expect(evalStr("xor(true, true)")).toBe(false);
  });

  it("and/or support more than two arguments", () => {
    expect(evalStr("and(true, true, true)")).toBe(true);
    expect(evalStr("and(true, true, false)")).toBe(false);
    expect(evalStr("or(false, false, true)")).toBe(true);
  });
});

describe("string functions", () => {
  it("contains/startsWith/endsWith are case-insensitive", () => {
    expect(evalStr("contains('refs/heads/releases/1.0', 'releases/')")).toBe(true);
    expect(evalStr("startsWith('Release-1.0', 'release-')")).toBe(true);
    expect(evalStr("endsWith('archive.TAR.GZ', '.tar.gz')")).toBe(true);
  });

  it("join concatenates array-typed parameter elements with a separator", () => {
    expect(evalStr("join(',', parameters.tags)", { parameters: { tags: ["a", "b", "c"] } })).toBe("a,b,c");
  });

  // Regression: a list-typed parameter that ends up holding a plain string
  // (e.g. from a UI control that incorrectly collapsed an array to one
  // value) must throw a catchable error here rather than crash silently
  // downstream - this is what the DAG engine/store catch and surface as a
  // diagnostic instead of a hard crash.
  it("join throws a catchable error when given a non-array/object value", () => {
    expect(() => evalStr("join(',', parameters.tags)", { parameters: { tags: "not-an-array" } })).toThrow(/array or object/);
  });

  it("format substitutes positional placeholders", () => {
    expect(evalStr("format('{0}-{1}', 'a', 'b')")).toBe("a-b");
  });

  it("coalesce returns the first non-null, non-empty-string argument", () => {
    expect(evalStr("coalesce('', 'first')")).toBe("first");
  });

  it("length counts string characters", () => {
    expect(evalStr("length('hello')")).toBe(5);
  });
});

describe("membership functions", () => {
  it("in/notIn compare the first argument against the rest", () => {
    expect(evalStr("in('b', 'a', 'b', 'c')")).toBe(true);
    expect(evalStr("in('z', 'a', 'b', 'c')")).toBe(false);
    expect(evalStr("notIn('z', 'a', 'b', 'c')")).toBe(true);
  });

  it("containsValue checks membership in an object/array-typed parameter", () => {
    expect(evalStr("containsValue(parameters.envs, 'prod')", { parameters: { envs: ["dev", "staging", "prod"] } })).toBe(true);
    expect(evalStr("containsValue(parameters.envs, 'test')", { parameters: { envs: ["dev", "staging", "prod"] } })).toBe(false);
  });
});
