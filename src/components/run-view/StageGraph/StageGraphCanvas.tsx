"use client";

import { useMemo } from "react";
import { ReactFlow, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowMinimize16Regular, ArrowMaximize16Regular } from "@fluentui/react-icons";
import type { StageVM } from "../view-model";
import { GraphNode } from "./nodes/GraphNode";
import { layoutDependencyGraph, type GraphItem } from "./graph-layout";
import { useGraphFocus } from "./use-graph-focus";

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

  const { height, focused, toggle } = useGraphFocus(256, 640);

  return (
    <div className="w-full shrink-0 border-b" style={{ borderColor: "var(--pc-border)", position: "relative", width: "100%", height }}>
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
      >
        <Controls showInteractive={false} />
      </ReactFlow>
      <button
        type="button"
        title={focused ? "Collapse" : "Expand"}
        aria-label={focused ? "Collapse stage graph" : "Expand stage graph"}
        onClick={toggle}
        className="absolute right-2 top-2 z-10 flex items-center justify-center rounded border bg-white p-1 hover:opacity-70"
        style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}
      >
        {focused ? <ArrowMinimize16Regular /> : <ArrowMaximize16Regular />}
      </button>
    </div>
  );
}
