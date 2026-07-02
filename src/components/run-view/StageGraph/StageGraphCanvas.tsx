"use client";

import { useMemo } from "react";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { StageVM } from "../view-model";
import { GraphNode } from "./nodes/GraphNode";
import { layoutDependencyGraph, type GraphItem } from "./graph-layout";

const nodeTypes = { graphNode: GraphNode };

export function StageGraphCanvas({
  stages,
  selectedStageId,
  onSelectStage,
}: {
  readonly stages: readonly StageVM[];
  readonly selectedStageId: string | null;
  readonly onSelectStage: (stageId: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const items: GraphItem[] = stages.map((stage) => ({
      id: stage.id,
      label: stage.name,
      result: stage.report.result,
      subtitle: `${stage.jobs.length} job${stage.jobs.length === 1 ? "" : "s"}`,
      dependsOn: stage.ir.dependsOn ?? [],
    }));
    return layoutDependencyGraph(items, selectedStageId, "graphNode");
  }, [stages, selectedStageId]);

  return (
    <div className="w-full shrink-0 border-b" style={{ borderColor: "var(--pc-border)", position: "relative", width: "100%", height: 256 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectStage(node.id)}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      />
    </div>
  );
}
