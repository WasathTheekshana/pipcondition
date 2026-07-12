"use client";

import { useState } from "react";
import { Share16Regular, Checkmark16Regular } from "@fluentui/react-icons";
import { usePipelineStore, getShareState } from "@/store/pipeline.store";
import { buildShareUrl } from "@/lib/share-link";

/**
 * Packs the current pipeline files + mock run config (variables, parameters,
 * mock outcomes, branch simulation, ...) into the URL itself and copies it -
 * no backend, no database, nothing to expire. Whoever opens the link sees
 * the exact same simulated run.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    setError(null);
    try {
      const url = buildShareUrl(getShareState(usePipelineStore.getState()));
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to clipboard - your browser may be blocking it.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleShare()}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
        style={{ borderColor: "var(--pc-accent)", color: "var(--pc-accent)" }}
        title="Copy a shareable link to this exact simulated run"
      >
        {copied ? <Checkmark16Regular /> : <Share16Regular />}
        {copied ? "Link copied" : "Share"}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--pc-failed)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
