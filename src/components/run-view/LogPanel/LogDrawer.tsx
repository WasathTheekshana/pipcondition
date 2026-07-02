"use client";

import type { StageVM } from "../view-model";
import { ExpressionTree } from "../ConditionBreakdown/ExpressionTree";
import { StatusIcon } from "../StatusIcon";
import { usePipelineStore } from "@/store/pipeline.store";
import type { MockOutcome } from "@/lib/dag";

const OUTCOME_OPTIONS: readonly MockOutcome[] = ["inherit", "Succeeded", "SucceededWithIssues", "Failed", "Canceled", "Skipped"];

function findSelected(stages: readonly StageVM[], nodeId: string, kind: "stage" | "job" | "step") {
  for (const stage of stages) {
    if (kind === "stage" && stage.id === nodeId) return { name: stage.name, ir: stage.ir, report: stage.report };
    for (const job of stage.jobs) {
      if (kind === "job" && job.id === nodeId) return { name: job.name, ir: job.ir, report: job.report };
      for (const step of job.steps) {
        if (kind === "step" && step.id === nodeId) return { name: step.name, ir: step.ir, report: step.report };
      }
    }
  }
  return null;
}

export function LogDrawer({
  stages,
  selectedNodeId,
  selectedNodeKind,
}: {
  readonly stages: readonly StageVM[];
  readonly selectedNodeId: string | null;
  readonly selectedNodeKind: "stage" | "job" | "step" | null;
}) {
  const outcomeOverrides = usePipelineStore((s) => s.outcomeOverrides);
  const setOutcomeOverride = usePipelineStore((s) => s.setOutcomeOverride);
  const setStepOutput = usePipelineStore((s) => s.setStepOutput);
  const removeStepOutput = usePipelineStore((s) => s.removeStepOutput);
  const stepOutputs = usePipelineStore((s) => s.stepOutputs);

  if (!selectedNodeId || !selectedNodeKind) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm" style={{ color: "var(--pc-text-secondary)" }}>
        Select a stage, job, or step to inspect its condition and force a mock outcome.
      </div>
    );
  }

  const found = findSelected(stages, selectedNodeId, selectedNodeKind);
  if (!found) return null;

  const { name, ir, report } = found;
  const currentOverride: MockOutcome = outcomeOverrides[selectedNodeId] ?? "inherit";
  const currentOutputs = stepOutputs[selectedNodeId] ?? {};

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center gap-2">
        <StatusIcon result={report.result} size={20} />
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--pc-text)" }}>
            {name}
          </div>
          <div className="text-xs capitalize" style={{ color: "var(--pc-text-secondary)" }}>
            {selectedNodeKind} &middot; {report.result}
          </div>
        </div>
      </div>

      {report.skippedReason && (
        <div className="rounded border px-2 py-1.5 text-xs" style={{ borderColor: "var(--pc-border)", background: "var(--pc-skipped-bg)", color: "var(--pc-text-secondary)" }}>
          Skipped: {report.skippedReason.replace(/-/g, " ")}
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
          Condition
        </div>
        <ExpressionTree trace={report.conditionTrace} source={ir.condition} />
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
          Mock outcome
        </div>
        <select
          className="w-full rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: "var(--pc-border)", color: "var(--pc-text)" }}
          value={currentOverride}
          onChange={(e) => setOutcomeOverride(selectedNodeId, e.target.value as MockOutcome)}
        >
          {OUTCOME_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "inherit" ? "Compute naturally" : opt}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs" style={{ color: "var(--pc-text-secondary)" }}>
          Only takes effect if this node&apos;s condition evaluates true.
        </p>
      </div>

      {selectedNodeKind === "step" && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
            Declared output variables
          </div>
          <OutputEditor
            values={currentOutputs}
            onChange={(name, value) => setStepOutput(selectedNodeId, name, value)}
            onRemove={(name) => removeStepOutput(selectedNodeId, name)}
          />
        </div>
      )}
    </div>
  );
}

function OutputEditor({
  values,
  onChange,
  onRemove,
}: {
  readonly values: Readonly<Record<string, string>>;
  readonly onChange: (name: string, value: string) => void;
  readonly onRemove: (name: string) => void;
}) {
  const entries = Object.entries(values);
  return (
    <div className="space-y-1">
      {entries.map(([name, value]) => (
        <div key={name} className="flex gap-1">
          <input className="w-1/3 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--pc-border)" }} value={name} disabled />
          <input
            className="flex-1 rounded border px-2 py-1 text-xs"
            style={{ borderColor: "var(--pc-border)" }}
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
          />
          <button type="button" className="px-1 text-xs" style={{ color: "var(--pc-text-secondary)" }} onClick={() => onRemove(name)} aria-label={`Remove ${name}`}>
            &times;
          </button>
        </div>
      ))}
      <AddOutputRow onAdd={(name) => onChange(name, "")} />
    </div>
  );
}

function AddOutputRow({ onAdd }: { readonly onAdd: (name: string) => void }) {
  return (
    <input
      className="w-full rounded border px-2 py-1 text-xs"
      style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}
      placeholder="+ add output variable name, press Enter"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.currentTarget.value.trim()) {
          onAdd(e.currentTarget.value.trim());
          e.currentTarget.value = "";
        }
      }}
    />
  );
}
