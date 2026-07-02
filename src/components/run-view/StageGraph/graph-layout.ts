import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { Result } from "@/lib/expr/context";
import type { GraphNodeData } from "./nodes/GraphNode";

const NODE_WIDTH = 192;
const NODE_HEIGHT = 64;

// Azure Pipelines' own stage graph connects boxes with a plain, thin, neutral
// line and no arrowhead - status is conveyed by the box border/icon, not the
// connector. Match that exactly instead of styling the line itself.
const EDGE_COLOR = "#9ca3af";
const EDGE_SKIPPED_COLOR = "#d4d4d8";

export interface GraphItem {
  readonly id: string;
  readonly label: string;
  readonly result: Result;
  readonly subtitle: string;
  readonly dependsOn: readonly string[];
}

/** Shared dagre + React Flow layout for both the stage graph and the job graph - same simple left-to-right dependsOn arrows, just fed different nodes. */
export function layoutDependencyGraph(items: readonly GraphItem[], selectedId: string | null, nodeType: string): { readonly nodes: Node[]; readonly edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 64 });

  const ids = new Set(items.map((i) => i.id));
  for (const item of items) {
    g.setNode(item.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  const edgeList: { readonly from: string; readonly to: string }[] = [];
  for (const item of items) {
    for (const dep of item.dependsOn) {
      if (!ids.has(dep)) continue;
      g.setEdge(dep, item.id);
      edgeList.push({ from: dep, to: item.id });
    }
  }
  dagre.layout(g);

  const nodes: Node[] = items.map((item) => {
    const pos = g.node(item.id);
    const data: GraphNodeData = { label: item.label, result: item.result, subtitle: item.subtitle, selected: item.id === selectedId };
    return {
      id: item.id,
      type: nodeType,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data,
    };
  });

  const itemById = new Map(items.map((i) => [i.id, i]));
  const edges: Edge[] = edgeList.map(({ from, to }) => {
    const target = itemById.get(to)!;
    const taken = target.result !== "Skipped";
    return {
      id: `${from}->${to}`,
      source: from,
      target: to,
      style: { stroke: taken ? EDGE_COLOR : EDGE_SKIPPED_COLOR, strokeWidth: 1.5 },
    };
  });

  return { nodes, edges };
}
