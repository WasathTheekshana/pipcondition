"use client";

import { useMemo } from "react";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { JobVM } from "../view-model";
import { GraphNode } from "./nodes/GraphNode";
import { layoutDependencyGraph, type GraphItem } from "./graph-layout";

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

  if (jobs.length <= 1) return null;

  return (
    <div className="w-full rounded-xl border" style={{ borderColor: "var(--pc-border)", position: "relative", width: "100%", height: 200 }}>
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
      />
    </div>
  );
}
