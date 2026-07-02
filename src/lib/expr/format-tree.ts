import type { ExprNode } from "./ast";
import type { RuntimeValue } from "./values";

/**
 * A single evaluated node in an expression's evaluation tree, used to drive
 * the UI's "condition breakdown" panel: clicking a skipped job shows this
 * tree with each function call's resolved value highlighted.
 */
export interface TraceNode {
  readonly node: ExprNode;
  readonly value: RuntimeValue;
  readonly children: readonly TraceNode[];
}

function describeNode(node: ExprNode): string {
  switch (node.kind) {
    case "FunctionCall":
      return `${node.name}(...)`;
    case "PropertyAccess":
      return node.path.map((seg) => (seg.kind === "identifier" ? seg.name : "[...]")).join(".");
    case "StringLiteral":
      return `'${node.value}'`;
    case "NumberLiteral":
      return String(node.value);
    case "BooleanLiteral":
      return String(node.value);
  }
}

export function formatTrace(trace: TraceNode, indent = ""): string {
  const line = `${indent}${describeNode(trace.node)} => ${JSON.stringify(trace.value)}`;
  const childLines = trace.children.map((child) => formatTrace(child, `${indent}  `));
  return [line, ...childLines].join("\n");
}
