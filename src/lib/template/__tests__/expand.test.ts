import { describe, expect, it } from "vitest";
import { expandValue } from "../expand";
import type { TemplateScope } from "../template-expr";

describe("whole-scalar and embedded substitution", () => {
  it("substitutes a whole-scalar expression preserving its type", () => {
    const scope: TemplateScope = { parameters: { count: 3, enabled: true } };
    expect(expandValue("${{ parameters.count }}", scope)).toBe(3);
    expect(expandValue("${{ parameters.enabled }}", scope)).toBe(true);
  });

  it("concatenates an embedded expression within a larger string", () => {
    const scope: TemplateScope = { parameters: { env: "prod" } };
    expect(expandValue("build-${{ parameters.env }}-job", scope)).toBe("build-prod-job");
  });

  it("leaves plain strings without ${{ }} untouched", () => {
    expect(expandValue("hello world", {})).toBe("hello world");
  });

  it("recurses through nested arrays and objects", () => {
    const scope: TemplateScope = { parameters: { env: "prod" } };
    const input = { steps: [{ script: "deploy ${{ parameters.env }}" }] };
    expect(expandValue(input, scope)).toEqual({ steps: [{ script: "deploy prod" }] });
  });

  // Regression: a string with TWO separate ${{ }} expressions used to be
  // misdetected as one whole-scalar expression, greedily capturing from the
  // first `${{` to the LAST `}}` (including the literal text and second
  // expression in between) as if it were a single expression body - which
  // then failed to parse with "Unexpected character '}'".
  it("concatenates two or more separate ${{ }} expressions in the same string, not a single whole-scalar match", () => {
    const scope: TemplateScope = { parameters: { environment: "prod" }, region: { name: "eastus" } };
    expect(expandValue("${{ parameters.environment }}-${{ region.name }}", scope)).toBe("prod-eastus");
    expect(expandValue("env: ${{ parameters.environment }}, region: ${{ region.name }}", scope)).toBe("env: prod, region: eastus");
  });
});

describe("${{ if / elseif / else }} as mapping keys", () => {
  it("merges the matching branch's keys into the parent object", () => {
    const scope: TemplateScope = { parameters: { env: "prod" } };
    const input = {
      normalVar: "x",
      "${{ if eq(parameters.env, 'prod') }}": { prodVar: "yes" },
      "${{ else }}": { prodVar: "no" },
    };
    expect(expandValue(input, scope)).toEqual({ normalVar: "x", prodVar: "yes" });
  });

  it("falls through to else when the if is false", () => {
    const scope: TemplateScope = { parameters: { env: "staging" } };
    const input = {
      "${{ if eq(parameters.env, 'prod') }}": { prodVar: "yes" },
      "${{ elseif eq(parameters.env, 'staging') }}": { prodVar: "staging-value" },
      "${{ else }}": { prodVar: "no" },
    };
    expect(expandValue(input, scope)).toEqual({ prodVar: "staging-value" });
  });

  it("includes nothing when no branch matches and there is no else", () => {
    const scope: TemplateScope = { parameters: { env: "dev" } };
    const input = { "${{ if eq(parameters.env, 'prod') }}": { prodVar: "yes" } };
    expect(expandValue(input, scope)).toEqual({});
  });
});

describe("${{ if / elseif / else }} as sequence items", () => {
  it("splices the matching branch's array into the parent list", () => {
    const scope: TemplateScope = { parameters: { runExtra: true } };
    const input = [
      { script: "always runs" },
      { "${{ if parameters.runExtra }}": [{ script: "extra 1" }, { script: "extra 2" }] },
      { "${{ else }}": [{ script: "fallback" }] },
    ];
    expect(expandValue(input, scope)).toEqual([{ script: "always runs" }, { script: "extra 1" }, { script: "extra 2" }]);
  });

  it("uses the else branch when the condition is false", () => {
    const scope: TemplateScope = { parameters: { runExtra: false } };
    const input = [{ "${{ if parameters.runExtra }}": [{ script: "extra" }] }, { "${{ else }}": [{ script: "fallback" }] }];
    expect(expandValue(input, scope)).toEqual([{ script: "fallback" }]);
  });
});

describe("${{ each }}", () => {
  it("repeats a mapping template once per element, binding the loop variable", () => {
    const scope: TemplateScope = { parameters: { envs: ["dev", "prod"] } };
    const input = {
      "${{ each env in parameters.envs }}": { "var-${{ env }}": "${{ env }}" },
    };
    expect(expandValue(input, scope)).toEqual({ "var-dev": "dev", "var-prod": "prod" });
  });

  it("repeats a sequence template once per element and flattens results", () => {
    const scope: TemplateScope = { parameters: { envs: ["dev", "prod"] } };
    const input = [{ "${{ each env in parameters.envs }}": [{ script: "deploy ${{ env }}" }] }];
    expect(expandValue(input, scope)).toEqual([{ script: "deploy dev" }, { script: "deploy prod" }]);
  });
});

describe("${{ insert }}", () => {
  it("merges an object parameter's keys directly into the parent mapping", () => {
    const scope: TemplateScope = { parameters: { extraVars: { a: "1", b: "2" } } };
    const input = { known: "x", "${{ insert }}": "${{ parameters.extraVars }}" };
    expect(expandValue(input, scope)).toEqual({ known: "x", a: "1", b: "2" });
  });
});
