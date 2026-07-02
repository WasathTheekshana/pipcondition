export interface Span {
  readonly start: number;
  readonly end: number;
}

export type PropertyPathSegment =
  | { readonly kind: "identifier"; readonly name: string }
  | { readonly kind: "index"; readonly expr: ExprNode };

export type ExprNode =
  | { readonly kind: "FunctionCall"; readonly name: string; readonly args: readonly ExprNode[]; readonly span: Span }
  | { readonly kind: "PropertyAccess"; readonly path: readonly PropertyPathSegment[]; readonly span: Span }
  | { readonly kind: "StringLiteral"; readonly value: string; readonly span: Span }
  | { readonly kind: "NumberLiteral"; readonly value: number; readonly span: Span }
  | { readonly kind: "BooleanLiteral"; readonly value: boolean; readonly span: Span };
