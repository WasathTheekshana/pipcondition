import { tokenize, type Token } from "./lexer";
import { ExpressionError } from "./errors";
import type { ExprNode, PropertyPathSegment } from "./ast";

const BOOLEAN_LITERALS = new Set(["true", "false"]);

class Parser {
  private readonly tokens: readonly Token[];
  private pos = 0;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t.kind !== "EOF") this.pos++;
    return t;
  }

  private expect(kind: Token["kind"]): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new ExpressionError(`Expected ${kind} but found '${t.text || "end of expression"}'`, t.span);
    }
    return this.advance();
  }

  parseProgram(): ExprNode {
    const node = this.parsePrimary();
    const trailing = this.peek();
    if (trailing.kind !== "EOF") {
      throw new ExpressionError(`Unexpected trailing input near '${trailing.text}'`, trailing.span);
    }
    return node;
  }

  private parsePrimary(): ExprNode {
    const t = this.peek();

    if (t.kind === "Number") {
      this.advance();
      return { kind: "NumberLiteral", value: t.value as number, span: t.span };
    }

    if (t.kind === "String") {
      this.advance();
      return { kind: "StringLiteral", value: t.value as string, span: t.span };
    }

    if (t.kind === "Identifier") {
      const lower = t.text.toLowerCase();
      const next = this.tokens[this.pos + 1];

      if (next.kind === "LParen") {
        return this.parseFunctionCall();
      }

      if (BOOLEAN_LITERALS.has(lower) && next.kind !== "Dot" && next.kind !== "LBracket") {
        this.advance();
        return { kind: "BooleanLiteral", value: lower === "true", span: t.span };
      }

      return this.parsePropertyAccess();
    }

    throw new ExpressionError(`Unexpected token '${t.text || "end of expression"}'`, t.span);
  }

  private parseFunctionCall(): ExprNode {
    const nameToken = this.expect("Identifier");
    this.expect("LParen");
    const args: ExprNode[] = [];

    if (this.peek().kind !== "RParen") {
      args.push(this.parsePrimary());
      while (this.peek().kind === "Comma") {
        this.advance();
        args.push(this.parsePrimary());
      }
    }

    const rparen = this.expect("RParen");
    return {
      kind: "FunctionCall",
      name: nameToken.text,
      args,
      span: { start: nameToken.span.start, end: rparen.span.end },
    };
  }

  private parsePropertyAccess(): ExprNode {
    const rootToken = this.expect("Identifier");
    const path: PropertyPathSegment[] = [{ kind: "identifier", name: rootToken.text }];
    let end = rootToken.span.end;

    for (;;) {
      const t = this.peek();
      if (t.kind === "Dot") {
        this.advance();
        const ident = this.expect("Identifier");
        path.push({ kind: "identifier", name: ident.text });
        end = ident.span.end;
        continue;
      }
      if (t.kind === "LBracket") {
        this.advance();
        const inner = this.parsePrimary();
        const closeBracket = this.expect("RBracket");
        path.push({ kind: "index", expr: inner });
        end = closeBracket.span.end;
        continue;
      }
      break;
    }

    return { kind: "PropertyAccess", path, span: { start: rootToken.span.start, end } };
  }
}

export function parseExpression(source: string): ExprNode {
  const tokens = tokenize(source);
  return new Parser(tokens).parseProgram();
}
