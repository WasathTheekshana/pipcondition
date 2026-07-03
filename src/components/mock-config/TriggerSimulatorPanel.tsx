"use client";

import { usePipelineStore } from "@/store/pipeline.store";
import { TRIGGER_REASONS } from "@/lib/trigger-simulation";

/** Lets the user simulate pushing to (or opening a PR from) a given branch, driving every Build.SourceBranch/Build.Reason-gated condition without having to know or type the raw variable names. */
export function TriggerSimulatorPanel() {
  const simulatedBranch = usePipelineStore((s) => s.simulatedBranch);
  const simulatedReason = usePipelineStore((s) => s.simulatedReason);
  const simulatedTargetBranch = usePipelineStore((s) => s.simulatedTargetBranch);
  const variables = usePipelineStore((s) => s.variables);
  const setTrigger = usePipelineStore((s) => s.setTrigger);

  const isPullRequest = simulatedReason === "PullRequest";

  return (
    <div className="border-t p-4" style={{ borderColor: "var(--pc-border)" }}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
        Simulate trigger
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5 text-sm" style={{ color: "var(--pc-text)" }}>
          Branch
          <input
            type="text"
            value={simulatedBranch}
            onChange={(e) => void setTrigger({ branch: e.target.value })}
            placeholder="Feature/my-feature"
            className="w-48 rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--pc-border)" }}
          />
        </label>

        <label className="flex flex-col gap-0.5 text-sm" style={{ color: "var(--pc-text)" }}>
          Trigger reason
          <select
            value={simulatedReason}
            onChange={(e) => void setTrigger({ reason: e.target.value as (typeof TRIGGER_REASONS)[number] })}
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--pc-border)" }}
          >
            {TRIGGER_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </label>

        {isPullRequest && (
          <label className="flex flex-col gap-0.5 text-sm" style={{ color: "var(--pc-text)" }}>
            PR target branch
            <input
              type="text"
              value={simulatedTargetBranch}
              onChange={(e) => void setTrigger({ targetBranch: e.target.value })}
              placeholder="main"
              className="w-40 rounded border px-2 py-1 text-sm"
              style={{ borderColor: "var(--pc-border)" }}
            />
          </label>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-0.5 font-mono text-xs" style={{ color: "var(--pc-text-secondary)" }}>
        <span>Build.SourceBranch = &apos;{variables["Build.SourceBranch"]}&apos;</span>
        <span>Build.SourceBranchName = &apos;{variables["Build.SourceBranchName"]}&apos;</span>
        <span>Build.Reason = &apos;{variables["Build.Reason"]}&apos;</span>
        {isPullRequest && (
          <>
            <span>System.PullRequest.SourceBranch = &apos;{variables["System.PullRequest.SourceBranch"]}&apos;</span>
            <span>System.PullRequest.TargetBranch = &apos;{variables["System.PullRequest.TargetBranch"]}&apos;</span>
          </>
        )}
      </div>
    </div>
  );
}
