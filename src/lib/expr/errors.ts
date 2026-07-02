import type { Span } from "./ast";

export class ExpressionError extends Error {
  readonly span: Span | undefined;
  readonly suggestion: string | undefined;

  constructor(message: string, span?: Span, suggestion?: string) {
    super(message);
    this.name = "ExpressionError";
    this.span = span;
    this.suggestion = suggestion;
  }
}
