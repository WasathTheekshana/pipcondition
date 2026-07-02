"use client";

import { usePipelineStore } from "@/store/pipeline.store";
import type { StageVM } from "@/components/run-view/view-model";

export function StageSelector({ stages }: { readonly stages: readonly StageVM[] }) {
  const excludedStages = usePipelineStore((s) => s.excludedStages);
  const toggleStageExcluded = usePipelineStore((s) => s.toggleStageExcluded);

  if (stages.length === 0) return null;

  return (
    <div className="border-t p-4" style={{ borderColor: "var(--pc-border)" }}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
        Stages to run
      </div>
      <div className="flex flex-wrap gap-3">
        {stages.map((stage) => (
          <label key={stage.id} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--pc-text)" }}>
            <input type="checkbox" checked={!excludedStages.includes(stage.id)} onChange={() => toggleStageExcluded(stage.id)} />
            {stage.name}
          </label>
        ))}
      </div>
    </div>
  );
}
