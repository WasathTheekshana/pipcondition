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

  it("flags a type mismatch as a warning", () => {
    const diagnostics: Diagnostic[] = [];
    resolveParameterValues([{ name: "count", type: "number" }], { count: "not-a-number" }, "root", diagnostics);
    expect(diagnostics.some((d) => d.severity === "warning" && /expected type 'number'/.test(d.message))).toBe(true);
  });

  it("passes through undeclared provided parameters with a warning", () => {
    const diagnostics: Diagnostic[] = [];
    const result = resolveParameterValues([], { extra: "value" }, "root", diagnostics);
    expect(result).toEqual({ extra: "value" });
    expect(diagnostics.some((d) => d.severity === "warning" && /not declared/.test(d.message))).toBe(true);
  });
});
