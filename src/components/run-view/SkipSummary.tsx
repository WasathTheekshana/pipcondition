"use client";

import type { StageVM } from "./view-model";
import { StatusIcon } from "./StatusIcon";
import type { SkippedReason } from "@/lib/dag";

function describeReason(reason: SkippedReason): string {
  switch (reason) {
    case "not-selected":
      return "not selected to run";
    case "dependency-skipped":
      return "a stage it depends on was skipped";
    case "dependency-failed-no-override":
      return "a stage it depends on failed";
    case "condition-false":
      return "its condition evaluated to false";
    default:
      return "skipped";
  }
}

export function SkipSummary({ stages }: { readonly stages: readonly StageVM[] }) {
  if (stages.length === 0) return null;

  const skipped = stages.filter((s) => s.report.result === "Skipped");
  const running = stages.length - skipped.length;

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3" style={{ borderColor: "var(--pc-border)" }}>
      <div className="text-sm" style={{ color: "var(--pc-text)" }}>
        <span className="font-semibold">{running}</span> of <span className="font-semibold">{stages.length}</span> stage{stages.length === 1 ? "" : "s"} will run
        {skipped.length > 0 && (
          <>
            , <span className="font-semibold">{skipped.length}</span> will be skipped
          </>
        )}
        .
      </div>
      {skipped.length > 0 && (
        <ul className="flex flex-col gap-1">
          {skipped.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--pc-text-secondary)" }}>
              <StatusIcon result="Skipped" size={14} />
              <span className="font-medium" style={{ color: "var(--pc-text)" }}>
                {s.name}
              </span>
              &mdash; {describeReason(s.report.skippedReason)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
