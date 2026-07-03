"use client";

import { useMemo } from "react";
import { ReactFlow, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowMinimize16Regular, ArrowMaximize16Regular } from "@fluentui/react-icons";
import type { JobVM } from "../view-model";
import { GraphNode } from "./nodes/GraphNode";
import { layoutDependencyGraph, type GraphItem } from "./graph-layout";
import { useGraphFocus } from "./use-graph-focus";

const nodeTypes = { graphNode: GraphNode };

export function JobGraphCanvas({
  stageId,
  jobs,
  selectedNodeId,
  onSelectJob,
}: {
  readonly stageId: string;
  readonly jobs: readonly JobVM[];
  readonly selectedNodeId: string | null;
  readonly onSelectJob: (jobId: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const items: GraphItem[] = jobs.map((job) => ({
      id: job.id,
      label: job.name,
      result: job.report.result,
      subtitle: `${job.steps.length} step${job.steps.length === 1 ? "" : "s"}`,
      dependsOn: (job.ir.dependsOn ?? []).map((dep) => `${stageId}/${dep}`),
    }));
    return layoutDependencyGraph(items, selectedNodeId, "graphNode");
  }, [jobs, stageId, selectedNodeId]);

  const { height, focused, toggle } = useGraphFocus(200, 560);

  if (jobs.length <= 1) return null;

  return (
    <div className="w-full rounded-xl border" style={{ borderColor: "var(--pc-border)", position: "relative", width: "100%", height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectJob(node.id)}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Controls showInteractive={false} />
      </ReactFlow>
      <button
        type="button"
        title={focused ? "Collapse" : "Expand"}
        aria-label={focused ? "Collapse job graph" : "Expand job graph"}
        onClick={toggle}
        className="absolute right-2 top-2 z-10 flex items-center justify-center rounded border bg-white p-1 hover:opacity-70"
        style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}
      >
        {focused ? <ArrowMinimize16Regular /> : <ArrowMaximize16Regular />}
      </button>
    </div>
  );
}
