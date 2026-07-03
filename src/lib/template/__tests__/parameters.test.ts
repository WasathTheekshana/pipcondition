import { describe, expect, it } from "vitest";
import { parseParameterDeclarations, resolveParameterValues } from "../parameters";
import type { Diagnostic } from "../pipeline-ir";

describe("parseParameterDeclarations", () => {
  it("parses name/type/default/values", () => {
    const raw = [{ name: "env", type: "string", default: "dev", values: ["dev", "staging", "prod"] }];
    expect(parseParameterDeclarations(raw)).toEqual([{ name: "env", type: "string", default: "dev", values: ["dev", "staging", "prod"] }]);
  });

  it("ignores malformed entries", () => {
    expect(parseParameterDeclarations([{ type: "string" }, "not-an-object", null])).toEqual([]);
  });

  it("returns [] for non-array input", () => {
    expect(parseParameterDeclarations(undefined)).toEqual([]);
  });
});

describe("resolveParameterValues", () => {
  it("uses provided values over defaults", () => {
    const diagnostics: Diagnostic[] = [];
    const result = resolveParameterValues([{ name: "env", type: "string", default: "dev" }], { env: "prod" }, "root", diagnostics);
    expect(result).toEqual({ env: "prod" });
    expect(diagnostics).toEqual([]);
  });

  it("falls back to the default when not provided", () => {
    const diagnostics: Diagnostic[] = [];
    const result = resolveParameterValues([{ name: "env", type: "string", default: "dev" }], {}, "root", diagnostics);
    expect(result).toEqual({ env: "dev" });
  });

  it("flags a missing required parameter with no default", () => {
    const diagnostics: Diagnostic[] = [];
    resolveParameterValues([{ name: "env", type: "string" }], {}, "root", diagnostics);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe("error");
    expect(diagnostics[0].message).toMatch(/Missing required parameter 'env'/);
  });

  it("flags a value outside the declared allow-list", () => {
    const diagnostics: Diagnostic[] = [];
    resolveParameterValues([{ name: "env", type: "string", values: ["dev", "prod"] }], { env: "staging" }, "root", diagnostics);
    expect(diagnostics.some((d) => d.severity === "error" && /not one of the allowed values/.test(d.message))).toBe(true);
  });

  // Regression: a stale/corrupted override (e.g. saved by an older, buggy
  // version of a UI control before it was fixed) must not silently poison
  // the value for anything downstream that assumes the declared shape -
  // it's discarded in favor of the default rather than kept.
  it("discards a wrong-shaped override and falls back to the default, with a warning", () => {
    const diagnostics: Diagnostic[] = [];
    const result = resolveParameterValues([{ name: "tags", type: "object", default: ["a", "b"] }], { tags: "not-an-array" }, "root", diagnostics);
    expect(result).toEqual({ tags: ["a", "b"] });
    expect(diagnostics.some((d) => d.severity === "warning" && /wrong shape for type 'object'/.test(d.message))).toBe(true);
  });

  it("falls back to the type's zero-value when a wrong-shaped override has no default to recover to", () => {
    const diagnostics: Diagnostic[] = [];
    const result = resolveParameterValues([{ name: "count", type: "number" }], { count: "not-a-number" }, "root", diagnostics);
    expect(result).toEqual({ count: 0 });
    expect(diagnostics.some((d) => d.severity === "warning" && /wrong shape for type 'number'/.test(d.message))).toBe(true);
  });

  it("passes through undeclared provided parameters with a warning", () => {
    const diagnostics: Diagnostic[] = [];
    const result = resolveParameterValues([], { extra: "value" }, "root", diagnostics);
    expect(result).toEqual({ extra: "value" });
    expect(diagnostics.some((d) => d.severity === "warning" && /not declared/.test(d.message))).toBe(true);
  });

  // Regression: a list-typed parameter's `values:` allow-list constrains each
  // element of the array, not the array as a whole - this used to always
  // flag a valid stringList default/value as a false-positive error.
  it("validates each element of a list-typed parameter against its allow-list, not the whole array", () => {
    const decl = { name: "tests", type: "stringList", values: ["Sanity", "Regression", "APIM"] };

    const validDiagnostics: Diagnostic[] = [];
    resolveParameterValues([decl], { tests: ["Sanity", "Regression"] }, "root", validDiagnostics);
    expect(validDiagnostics).toEqual([]);

    const invalidDiagnostics: Diagnostic[] = [];
    resolveParameterValues([decl], { tests: ["Sanity", "NotAllowed"] }, "root", invalidDiagnostics);
    expect(invalidDiagnostics.some((d) => d.severity === "error" && /not one of the allowed values/.test(d.message))).toBe(true);
    // only the offending element is called out - the message shouldn't imply the valid "Sanity" entry was rejected too
    expect(invalidDiagnostics[0].message).toContain("NotAllowed");
    expect(invalidDiagnostics[0].message).not.toContain('["Sanity","NotAllowed"]');
  });
});
