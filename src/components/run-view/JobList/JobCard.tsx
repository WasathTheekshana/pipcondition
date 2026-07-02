"use client";

import { useState } from "react";
import { ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import type { JobVM } from "../view-model";
import { StatusIcon } from "../StatusIcon";
import { StepRow } from "../StepTimeline/StepRow";

export function JobCard({
  job,
  selectedNodeId,
  onSelectNode,
}: {
  readonly job: JobVM;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (nodeId: string, kind: "job" | "step") => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        style={{ background: selectedNodeId === job.id ? "var(--pc-inprogress-bg)" : "transparent" }}
        onClick={() => onSelectNode(job.id, "job")}
      >
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        </span>
        <StatusIcon result={job.report.result} />
        <span className="text-sm font-semibold" style={{ color: "var(--pc-text)" }}>
          {job.name}
        </span>
        {job.ir.dependsOn && job.ir.dependsOn.length > 0 && (
          <span className="text-xs" style={{ color: "var(--pc-text-secondary)" }}>
            depends on {job.ir.dependsOn.join(", ")}
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-t px-2 py-1" style={{ borderColor: "var(--pc-border)" }}>
          {job.steps.map((step) => (
            <StepRow key={step.id} step={step} selected={selectedNodeId === step.id} onSelect={() => onSelectNode(step.id, "step")} />
          ))}
        </div>
      )}
    </div>
  );
}
