"use client";

import Link from "next/link";
import { usePipelineStore } from "@/store/pipeline.store";
import { StatusIcon, statusColor, statusBackground, overallResult } from "@/components/run-view/StatusIcon";
import { Logo } from "./Logo";

export function TopNav() {
  const report = usePipelineStore((s) => s.report);
  const result = report ? overallResult(report.stages.map((s) => s.result)) : "NotStarted";

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur"
      style={{ background: "var(--pc-header-bg)", borderColor: "var(--pc-header-border)" }}
    >
      <Link href="/" className="flex items-center gap-3">
        <Logo />
        <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--pc-text)" }}>
          pipcondition
        </span>
      </Link>
      <span className="hidden text-xs sm:inline" style={{ color: "var(--pc-text-secondary)" }}>
        Azure Pipeline Condition Simulator
      </span>

      <div className="ml-auto flex items-center gap-3">
        <Link href="/about" className="text-sm font-medium underline" style={{ color: "var(--pc-text-secondary)" }}>
          About
        </Link>
        {report && (
          <div
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: statusColor(result), background: statusBackground(result), color: statusColor(result) }}
          >
            <StatusIcon result={result} size={14} />
            {result}
          </div>
        )}
      </div>
    </header>
  );
}
