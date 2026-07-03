"use client";

import { useState } from "react";
import { usePipelineStore } from "@/store/pipeline.store";
import { EXAMPLE_PIPELINES } from "@/lib/examples";

/** A row of bundled example pipelines a new user can load to see what pipcondition can simulate, without having to bring their own YAML first. */
export function ExamplesPanel() {
  const hasImportedFiles = usePipelineStore((s) => s.hasImportedFiles);
  const loadExample = usePipelineStore((s) => s.loadExample);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const requestLoad = (id: string) => {
    // Only ask for confirmation once the user has real content loaded -
    // loading straight over the untouched built-in demo needs no prompt.
    if (hasImportedFiles) setPendingId(id);
    else void loadExample(id);
  };

  const confirmLoad = () => {
    if (pendingId) void loadExample(pendingId);
    setPendingId(null);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
        Try an example
      </span>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PIPELINES.map((example) => (
          <button
            key={example.id}
            type="button"
            title={example.description}
            onClick={() => requestLoad(example.id)}
            className="rounded-full border px-3 py-1 text-xs font-medium hover:opacity-70"
            style={{ borderColor: "var(--pc-accent)", color: "var(--pc-accent)" }}
          >
            {example.name}
          </button>
        ))}
      </div>

      {pendingId && (
        <div className="flex flex-wrap items-center gap-3 rounded border px-3 py-2 text-xs" style={{ borderColor: "var(--pc-warning)", background: "var(--pc-warning-bg)", color: "var(--pc-text)" }}>
          <span>Replace your current files with this example? Your saved files and mock config will be cleared.</span>
          <button type="button" onClick={confirmLoad} className="rounded-full px-3 py-1 font-semibold text-white" style={{ background: "var(--pc-accent)" }}>
            Load example
          </button>
          <button type="button" onClick={() => setPendingId(null)} className="rounded-full border px-3 py-1 font-medium" style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
