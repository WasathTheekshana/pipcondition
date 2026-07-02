"use client";

import { CheckmarkCircle16Filled, ErrorCircle16Filled, Warning16Filled, Prohibited16Regular, DismissCircle16Filled, Circle16Regular } from "@fluentui/react-icons";
import type { Result } from "@/lib/expr/context";

const CONFIG: Record<Result, { readonly Icon: typeof CheckmarkCircle16Filled; readonly color: string }> = {
  Succeeded: { Icon: CheckmarkCircle16Filled, color: "var(--pc-success)" },
  SucceededWithIssues: { Icon: Warning16Filled, color: "var(--pc-warning)" },
  Failed: { Icon: ErrorCircle16Filled, color: "var(--pc-failed)" },
  Canceled: { Icon: DismissCircle16Filled, color: "var(--pc-canceled)" },
  Skipped: { Icon: Prohibited16Regular, color: "var(--pc-skipped)" },
  NotStarted: { Icon: Circle16Regular, color: "var(--pc-skipped)" },
};

export function StatusIcon({ result, size = 16 }: { readonly result: Result; readonly size?: number }) {
  const { Icon, color } = CONFIG[result];
  return <Icon fontSize={size} style={{ color }} />;
}

export function statusColor(result: Result): string {
  return CONFIG[result].color;
}

export function statusBackground(result: Result): string {
  switch (result) {
    case "Succeeded":
      return "var(--pc-success-bg)";
    case "SucceededWithIssues":
      return "var(--pc-warning-bg)";
    case "Failed":
      return "var(--pc-failed-bg)";
    case "Canceled":
      return "var(--pc-canceled-bg)";
    case "Skipped":
    case "NotStarted":
      return "var(--pc-skipped-bg)";
  }
}

/** Rolls up a set of stage results into one overall pipeline-run status, for the header/badge summary. */
export function overallResult(stageResults: readonly Result[]): Result {
  if (stageResults.length === 0) return "NotStarted";
  if (stageResults.some((r) => r === "Canceled")) return "Canceled";
  if (stageResults.some((r) => r === "Failed")) return "Failed";
  if (stageResults.every((r) => r === "Skipped")) return "Skipped";
  if (stageResults.some((r) => r === "SucceededWithIssues")) return "SucceededWithIssues";
  return "Succeeded";
}
