import { describe, expect, it } from "vitest";
import { parseExpression } from "../parser";
import { evaluateExpression, evaluateCondition } from "../evaluate";
import { createRunContext } from "../context";
import { ExpressionError } from "../errors";

function evalStr(source: string, overrides: Parameters<typeof createRunContext>[0] = {}) {
  return evaluateExpression(parseExpression(source), createRunContext(overrides));
}

describe("status functions", () => {
  it("default condition succeeded() reflects aggregate status", () => {
    expect(evalStr("succeeded()", { aggregateStatus: "Succeeded" })).toBe(true);
    expect(evalStr("succeeded()", { aggregateStatus: "SucceededWithIssues" })).toBe(true);
    expect(evalStr("succeeded()", { aggregateStatus: "Failed" })).toBe(false);
  });

  it("failed() reflects aggregate status", () => {
    expect(evalStr("failed()", { aggregateStatus: "Failed" })).toBe(true);
    expect(evalStr("failed()", { aggregateStatus: "Succeeded" })).toBe(false);
  });

  it("always() ignores status entirely", () => {
    expect(evalStr("always()", { aggregateStatus: "Failed" })).toBe(true);
    expect(evalStr("always()", { aggregateStatus: "Canceled" })).toBe(true);
  });

  it("succeeded() with named dependency args checks that dependency specifically", () => {
    const ctx = { dependencies: { JobA: { result: "Failed" as const, outputs: {} }, JobB: { result: "Succeeded" as const, outputs: {} } } };
    expect(evalStr("succeeded('JobA')", ctx)).toBe(false);
    expect(evalStr("succeeded('JobB')", ctx)).toBe(true);
    expect(evalStr("succeeded('JobA', 'JobB')", ctx)).toBe(false);
  });

  it("throws referencing an unknown dependency by name", () => {
    expect(() => evalStr("succeeded('Nope')")).toThrow(ExpressionError);
  });
});

describe("dependencies.*.result and .outputs", () => {
  it("resolves eq(dependencies.A.result, 'SucceededWithIssues')", () => {
    const ctx = { dependencies: { A: { result: "SucceededWithIssues" as const, outputs: {} } } };
    expect(evalStr("eq(dependencies.A.result, 'SucceededWithIssues')", ctx)).toBe(true);
  });

  it("resolves dependencies.<name>.outputs via bracket and dot chains identically", () => {
    const ctx = { dependencies: { A: { result: "Succeeded" as const, outputs: { "JobA.StepA.MyVar": "hello" } } } };
    expect(evalStr("eq(dependencies.A.outputs['JobA.StepA.MyVar'], 'hello')", ctx)).toBe(true);
  });

  it("unset output keys resolve to empty string, not an error", () => {
    const ctx = { dependencies: { A: { result: "Succeeded" as const, outputs: {} } } };
    expect(evalStr("eq(dependencies.A.outputs['missing'], '')", ctx)).toBe(true);
  });
});

describe("stageDependencies", () => {
  it("resolves cross-stage job outputs", () => {
    const ctx = {
      stageDependencies: { StageA: { JobA: { result: "Succeeded" as const, outputs: { "StepA.MyVar": "42" } } } },
    };
    expect(evalStr("eq(stageDependencies.StageA.JobA.outputs['StepA.MyVar'], '42')", ctx)).toBe(true);
    expect(evalStr("eq(stageDependencies.StageA.JobA.result, 'Succeeded')", ctx)).toBe(true);
  });
});

describe("variables and parameters", () => {
  it("resolves variables case-insensitively and treats unset as empty string", () => {
    const ctx = { variables: { "Build.Reason": "PullRequest" } };
    expect(evalStr("eq(variables['Build.Reason'], 'PullRequest')", ctx)).toBe(true);
    expect(evalStr("eq(variables['build.reason'], 'PullRequest')", ctx)).toBe(true);
    expect(evalStr("eq(variables['Missing'], '')", ctx)).toBe(true);
  });

  it("resolves nested object/array parameters", () => {
    const ctx = { parameters: { config: { retries: 3, tags: ["a", "b"] } } };
    expect(evalStr("eq(parameters.config.retries, 3)", ctx)).toBe(true);
    expect(evalStr("eq(parameters['config']['tags'][0], 'a')", ctx)).toBe(true);
  });

  it("throws for unknown parameter names", () => {
    expect(() => evalStr("eq(parameters.nope, 1)")).toThrow(ExpressionError);
  });
});

describe("golden examples from the Conditions/Expressions docs", () => {
  it("and(succeeded(), eq(variables['Build.Reason'], 'PullRequest'))", () => {
    expect(
      evalStr("and(succeeded(), eq(variables['Build.Reason'], 'PullRequest'))", {
        aggregateStatus: "Succeeded",
        variables: { "Build.Reason": "PullRequest" },
      }),
    ).toBe(true);
  });

  it("counter() persists across evaluations sharing the same context", () => {
    const ctx = createRunContext();
    const node = parseExpression("counter('build', 100)");
    expect(evaluateExpression(node, ctx)).toBe(100);
    expect(evaluateExpression(node, ctx)).toBe(101);
    expect(evaluateExpression(node, ctx)).toBe(102);
  });

  it("counter() does not persist across separate contexts (separate simulated runs)", () => {
    const node = parseExpression("counter('build', 100)");
    expect(evaluateExpression(node, createRunContext())).toBe(100);
    expect(evaluateExpression(node, createRunContext())).toBe(100);
  });
});

describe("evaluateCondition", () => {
  it("produces a trace tree alongside the boolean result", () => {
    const node = parseExpression("and(succeeded(), eq(1, 1))");
    const { result, trace } = evaluateCondition(node, createRunContext());
    expect(result).toBe(true);
    expect(trace.children).toHaveLength(2);
    expect(trace.children[0].value).toBe(true);
    expect(trace.children[1].value).toBe(true);
  });

  it("evaluates every argument to and()/or() even when the first already determines nothing (no short-circuit)", () => {
    const ctx = createRunContext();
    const node = parseExpression("or(eq(1,2), eq(counter('c',1), 1))");
    evaluateExpression(node, ctx);
    // counter('c', 1) must have run exactly once, incrementing state, proving or() evaluated both args
    expect(ctx.counters.get("c")).toBe(1);
  });
});

describe("arity and unknown-function errors", () => {
  it("rejects wrong argument counts", () => {
    expect(() => evalStr("eq(1)")).toThrow(ExpressionError);
    expect(() => evalStr("not(1,2)")).toThrow(ExpressionError);
  });
  it("rejects unknown functions", () => {
    expect(() => evalStr("bogus(1)")).toThrow(/Unknown function/);
  });
});
