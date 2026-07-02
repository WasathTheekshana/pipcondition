"use client";

import type { TraceNode } from "@/lib/expr/format-tree";
import type { ExprNode } from "@/lib/expr/ast";

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

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return `'${value}'`;
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function valueTone(value: unknown): string {
  if (value === true) return "var(--pc-success)";
  if (value === false) return "var(--pc-failed)";
  return "var(--pc-text-secondary)";
}

function TreeNode({ trace, depth }: { readonly trace: TraceNode; readonly depth: number }) {
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 14 }}>
      <div className="flex items-center gap-2 border-l pl-2 py-0.5" style={{ borderColor: "var(--pc-border)" }}>
        <code className="text-xs" style={{ color: "var(--pc-text)" }}>
          {describeNode(trace.node)}
        </code>
        <span className="text-xs font-semibold" style={{ color: valueTone(trace.value) }}>
          {formatValue(trace.value)}
        </span>
      </div>
      {trace.children.map((child, i) => (
        <TreeNode key={i} trace={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ExpressionTree({ trace, source }: { readonly trace: TraceNode; readonly source: string }) {
  return (
    <div>
      <div className="mb-2 rounded border px-2 py-1.5 font-mono text-xs" style={{ borderColor: "var(--pc-border)", background: "var(--pc-canvas-bg)", color: "var(--pc-text-secondary)" }}>
        condition: {source}
      </div>
      <TreeNode trace={trace} depth={0} />
    </div>
  );
}
