"use client";

import { useState } from "react";
import Link from "next/link";
import { usePipelineStore } from "@/store/pipeline.store";
import { useUiStore } from "@/store/ui.store";
import { useOnboardingStore } from "@/store/onboarding.store";
import { ArrowLeftIcon } from "@/components/chrome/BrandIcons";

export default function SettingsPage() {
  const files = usePipelineStore((s) => s.files);
  const variables = usePipelineStore((s) => s.variables);
  const parameters = usePipelineStore((s) => s.parameters);
  const outcomeOverrides = usePipelineStore((s) => s.outcomeOverrides);
  const clearAllData = usePipelineStore((s) => s.clearAllData);
  const openWelcome = useOnboardingStore((s) => s.openWelcome);

  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  const fileCount = Object.keys(files).length;
  const variableCount = Object.keys(variables).length;
  const parameterCount = Object.keys(parameters).length;
  const overrideCount = Object.keys(outcomeOverrides).length;

  const handleConfirm = async () => {
    await clearAllData();
    useUiStore.getState().selectStage(null);
    useUiStore.getState().selectNode(null, null);
    setConfirming(false);
    setCleared(true);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/" className="flex items-center gap-1 text-sm underline" style={{ color: "var(--pc-text-secondary)" }}>
        <ArrowLeftIcon />
        Back to app
      </Link>

      <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--pc-text)" }}>
        Settings
      </h1>

      <section className="rounded-xl border p-6" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
          Local storage
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--pc-text)" }}>
          Everything you paste or drop into pipcondition - pipeline files, run parameters, variables, and mock outcome
          overrides - is saved to your browser&apos;s local storage automatically, so it&apos;s still here next time you open
          the app. Nothing is ever sent to a server.
        </p>
        <ul className="text-sm" style={{ color: "var(--pc-text-secondary)" }}>
          <li>
            <strong style={{ color: "var(--pc-text)" }}>{fileCount}</strong> file{fileCount === 1 ? "" : "s"} saved
          </li>
          <li>
            <strong style={{ color: "var(--pc-text)" }}>{variableCount}</strong> mock variable{variableCount === 1 ? "" : "s"}
          </li>
          <li>
            <strong style={{ color: "var(--pc-text)" }}>{parameterCount}</strong> parameter override{parameterCount === 1 ? "" : "s"}
          </li>
          <li>
            <strong style={{ color: "var(--pc-text)" }}>{overrideCount}</strong> mock outcome override{overrideCount === 1 ? "" : "s"}
          </li>
        </ul>
      </section>

      <section className="rounded-xl border p-6" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
          Help
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--pc-text)" }}>
          Want a refresher on how pipcondition works?
        </p>
        <button
          type="button"
          onClick={() => openWelcome()}
          className="rounded-full border px-4 py-1.5 text-sm font-semibold"
          style={{ borderColor: "var(--pc-accent)", color: "var(--pc-accent)" }}
        >
          Re-watch welcome guide
        </button>
      </section>

      <section className="rounded-xl border p-6" style={{ borderColor: "var(--pc-failed)", background: "var(--pc-failed-bg)" }}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pc-failed)" }}>
          Danger zone
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--pc-text)" }}>
          Permanently delete every saved file and mock configuration from this browser, and reset pipcondition back to the
          built-in demo pipeline. This cannot be undone.
        </p>

        {!confirming ? (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setCleared(false);
            }}
            className="rounded-full border px-4 py-1.5 text-sm font-semibold"
            style={{ borderColor: "var(--pc-failed)", color: "var(--pc-failed)" }}
          >
            Clear all data
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium" style={{ color: "var(--pc-failed)" }}>
              Are you sure? This can&apos;t be undone.
            </span>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
              style={{ background: "var(--pc-failed)" }}
            >
              Yes, clear everything
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full border px-4 py-1.5 text-sm font-medium"
              style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        )}

        {cleared && (
          <p className="mt-3 text-sm font-medium" style={{ color: "var(--pc-success)" }}>
            All data cleared. pipcondition is back to the demo pipeline.
          </p>
        )}
      </section>
    </div>
  );
}
