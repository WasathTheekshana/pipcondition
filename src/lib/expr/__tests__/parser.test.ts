import { describe, expect, it } from "vitest";
import { parseExpression } from "../parser";

describe("parseExpression", () => {
  it("parses a function call with nested function args", () => {
    const ast = parseExpression("and(succeeded(), eq(1, 2))");
    expect(ast).toMatchObject({
      kind: "FunctionCall",
      name: "and",
      args: [
        { kind: "FunctionCall", name: "succeeded", args: [] },
        { kind: "FunctionCall", name: "eq", args: [{ kind: "NumberLiteral", value: 1 }, { kind: "NumberLiteral", value: 2 }] },
      ],
    });
  });

  it("parses bracket property access", () => {
    const ast = parseExpression("variables['Build.Reason']");
    expect(ast).toMatchObject({
      kind: "PropertyAccess",
      path: [
        { kind: "identifier", name: "variables" },
        { kind: "index", expr: { kind: "StringLiteral", value: "Build.Reason" } },
      ],
    });
  });

  it("parses dotted property access chains", () => {
    const ast = parseExpression("dependencies.StageA.result");
    expect(ast).toMatchObject({
      kind: "PropertyAccess",
      path: [
        { kind: "identifier", name: "dependencies" },
        { kind: "identifier", name: "StageA" },
        { kind: "identifier", name: "result" },
      ],
    });
  });

  it("parses mixed dot and bracket chains", () => {
    const ast = parseExpression("dependencies.StageA.outputs['JobA.StepA.MyVar']");
    expect(ast).toMatchObject({
      kind: "PropertyAccess",
      path: [
        { kind: "identifier", name: "dependencies" },
        { kind: "identifier", name: "StageA" },
        { kind: "identifier", name: "outputs" },
        { kind: "index", expr: { kind: "StringLiteral", value: "JobA.StepA.MyVar" } },
      ],
    });
  });

  it("parses boolean literals case-insensitively", () => {
    expect(parseExpression("true")).toMatchObject({ kind: "BooleanLiteral", value: true });
    expect(parseExpression("False")).toMatchObject({ kind: "BooleanLiteral", value: false });
  });

  it("rejects trailing input", () => {
    expect(() => parseExpression("eq(1,2) extra")).toThrow(/Unexpected trailing input/);
  });

  it("rejects unknown token at start", () => {
    expect(() => parseExpression(",")).toThrow();
  });

  it("rejects unclosed function call", () => {
    expect(() => parseExpression("eq(1, 2")).toThrow();
  });
});
