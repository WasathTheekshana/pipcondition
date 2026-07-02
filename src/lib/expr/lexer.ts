import { ExpressionError } from "./errors";
import type { Span } from "./ast";

export type TokenKind =
  | "Identifier"
  | "String"
  | "Number"
  | "LParen"
  | "RParen"
  | "LBracket"
  | "RBracket"
  | "Dot"
  | "Comma"
  | "EOF";

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly value?: string | number;
  readonly span: Span;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

/**
 * Azure Pipelines condition expressions are a small prefix function-call
 * grammar (no infix operators, no generic parenthesized grouping).
 * See: https://learn.microsoft.com/en-us/azure/devops/pipelines/process/expressions
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const c = source[i];

    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      i++;
      continue;
    }

    const start = i;

    if (c === "(") {
      tokens.push({ kind: "LParen", text: "(", span: { start, end: i + 1 } });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "RParen", text: ")", span: { start, end: i + 1 } });
      i++;
      continue;
    }
    if (c === "[") {
      tokens.push({ kind: "LBracket", text: "[", span: { start, end: i + 1 } });
      i++;
      continue;
    }
    if (c === "]") {
      tokens.push({ kind: "RBracket", text: "]", span: { start, end: i + 1 } });
      i++;
      continue;
    }
    if (c === ".") {
      tokens.push({ kind: "Dot", text: ".", span: { start, end: i + 1 } });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ kind: "Comma", text: ",", span: { start, end: i + 1 } });
      i++;
      continue;
    }

    if (c === "'") {
      i++;
      let value = "";
      let closed = false;
      while (i < n) {
        if (source[i] === "'") {
          if (source[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        value += source[i];
        i++;
      }
      if (!closed) {
        throw new ExpressionError("Unterminated string literal", { start, end: i });
      }
      tokens.push({ kind: "String", text: source.slice(start, i), value, span: { start, end: i } });
      continue;
    }

    if (DIGIT.test(c) || (c === "-" && DIGIT.test(source[i + 1] ?? ""))) {
      i++;
      while (i < n && DIGIT.test(source[i])) i++;
      if (source[i] === "." && DIGIT.test(source[i + 1] ?? "")) {
        i++;
        while (i < n && DIGIT.test(source[i])) i++;
      }
      const text = source.slice(start, i);
      tokens.push({ kind: "Number", text, value: Number(text), span: { start, end: i } });
      continue;
    }

    if (IDENT_START.test(c)) {
      i++;
      while (i < n && IDENT_PART.test(source[i])) i++;
      const text = source.slice(start, i);
      tokens.push({ kind: "Identifier", text, span: { start, end: i } });
      continue;
    }

    throw new ExpressionError(`Unexpected character '${c}'`, { start, end: i + 1 });
  }

  tokens.push({ kind: "EOF", text: "", span: { start: n, end: n } });
  return tokens;
}
