import { describe, expect, it } from "vitest";
import { tokenize } from "../lexer";

describe("tokenize", () => {
  it("tokenizes a simple function call", () => {
    const tokens = tokenize("eq(1, 2)");
    expect(tokens.map((t) => t.kind)).toEqual(["Identifier", "LParen", "Number", "Comma", "Number", "RParen", "EOF"]);
  });

  it("handles single-quoted strings with doubled-quote escapes", () => {
    const tokens = tokenize("'it''s'");
    expect(tokens[0].kind).toBe("String");
    expect(tokens[0].value).toBe("it's");
  });

  it("throws on unterminated string", () => {
    expect(() => tokenize("'unterminated")).toThrow(/Unterminated/);
  });

  it("tokenizes property access chains", () => {
    const tokens = tokenize("variables['Build.Reason']");
    expect(tokens.map((t) => t.kind)).toEqual(["Identifier", "LBracket", "String", "RBracket", "EOF"]);
  });

  it("tokenizes dotted property chains", () => {
    const tokens = tokenize("dependencies.StageA.result");
    expect(tokens.map((t) => t.kind)).toEqual(["Identifier", "Dot", "Identifier", "Dot", "Identifier", "EOF"]);
  });

  it("parses negative and decimal numbers", () => {
    const tokens = tokenize("eq(-1.5, 2)");
    expect(tokens[2].kind).toBe("Number");
    expect(tokens[2].value).toBe(-1.5);
  });

  it("throws on unexpected characters", () => {
    expect(() => tokenize("a & b")).toThrow(/Unexpected character/);
  });
});
