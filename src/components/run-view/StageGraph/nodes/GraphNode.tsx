"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Result } from "@/lib/expr/context";
import { StatusIcon, statusColor } from "../../StatusIcon";

export interface GraphNodeData extends Record<string, unknown> {
  readonly label: string;
  readonly result: Result;
  readonly subtitle: string;
  readonly selected: boolean;
}

export function GraphNode({ data }: NodeProps & { readonly data: GraphNodeData }) {
  return (
    <div
      className="w-48 rounded-xl border-2 px-3 py-2 shadow-sm"
      style={{
        background: "var(--pc-card-bg)",
        borderColor: data.selected ? "var(--pc-accent)" : statusColor(data.result),
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "var(--pc-border)" }} />
      <div className="flex items-center gap-2">
        <StatusIcon result={data.result} />
        <span className="truncate text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--pc-text)" }}>
          {data.label}
        </span>
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--pc-text-secondary)" }}>
        {data.subtitle}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "var(--pc-border)" }} />
    </div>
  );
}
