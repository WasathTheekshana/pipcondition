"use client";

import type { StepVM } from "../view-model";
import { StatusIcon } from "../StatusIcon";

export function StepRow({ step, selected, onSelect }: { readonly step: StepVM; readonly selected: boolean; readonly onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
      style={{ background: selected ? "var(--pc-inprogress-bg)" : "transparent" }}
    >
      <StatusIcon result={step.report.result} />
      <span className="truncate" style={{ color: "var(--pc-text)" }}>
        {step.name}
      </span>
      {step.ir.continueOnError && (
        <span className="ml-auto rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--pc-warning-bg)", color: "var(--pc-warning)" }}>
          continueOnError
        </span>
      )}
    </button>
  );
}
