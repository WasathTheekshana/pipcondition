"use client";

import type { Result } from "@/lib/expr/context";
import { StatusIcon, statusColor, overallResult } from "./StatusIcon";
import { usePipelineStore } from "@/store/pipeline.store";
import { ShareButton } from "./ShareButton";

export function RunHeader({ stageResults }: { readonly stageResults: readonly Result[] }) {
  const entryPath = usePipelineStore((s) => s.entryPath);
  const result = overallResult(stageResults);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <StatusIcon result={result} size={22} />
      <div>
        <div className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: statusColor(result) }}>
          Simulated run
        </div>
        <div className="text-xs" style={{ color: "var(--pc-text-secondary)" }}>
          {entryPath} &middot; dry-run simulation, nothing was actually executed
        </div>
      </div>
      <div className="ml-auto">
        <ShareButton />
      </div>
    </div>
  );
}
