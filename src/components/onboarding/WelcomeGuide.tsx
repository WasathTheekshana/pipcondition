"use client";

import { useEffect, useState } from "react";
import { Dismiss24Regular, ChevronLeft16Regular, ChevronRight16Regular, DocumentArrowUp24Regular, PlayCircle24Regular, ShieldCheckmark24Regular } from "@fluentui/react-icons";
import { Logo } from "@/components/chrome/Logo";
import { useOnboardingStore } from "@/store/onboarding.store";

interface Slide {
  readonly icon?: typeof DocumentArrowUp24Regular;
  readonly title: string;
  readonly body: string;
}

const SLIDES: readonly Slide[] = [
  {
    title: "Welcome to pipcondition",
    body: "Test Azure Pipelines condition: expressions and dependsOn graphs locally - no more burning a PR approval just to find out whether a condition tweak actually works.",
  },
  {
    icon: DocumentArrowUp24Regular,
    title: "Import your pipeline",
    body: "Paste your azure-pipelines.yml directly into the editor, or drag and drop the whole repo - entry file plus any templates/*.yml it references. Pick which file is the entry point from the file tree.",
  },
  {
    icon: PlayCircle24Regular,
    title: "Configure and simulate",
    body: "Set runtime parameters, deselect stages you don't want to run, or force a specific stage/job/step to a mock outcome. Click any node in the graph to see exactly how its condition evaluated.",
  },
  {
    icon: ShieldCheckmark24Regular,
    title: "Everything stays on your device",
    body: "Nothing you paste or configure is ever sent to a server. It's saved to your browser's local storage so it's here next time - and you can wipe it anytime from Settings.",
  },
];

export function WelcomeGuide() {
  const isOpen = useOnboardingStore((s) => s.isOpen);
  const openWelcome = useOnboardingStore((s) => s.openWelcome);
  const completeWelcome = useOnboardingStore((s) => s.completeWelcome);
  const [step, setStep] = useState(0);

  // Runs once after zustand's persist middleware has rehydrated hasSeenWelcome
  // from localStorage - opens the guide automatically on a genuinely first visit.
  useEffect(() => {
    if (!useOnboardingStore.getState().hasSeenWelcome) {
      openWelcome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const Icon = slide.icon;

  const finish = () => {
    completeWelcome();
    setStep(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-xl border p-6" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
        <button type="button" onClick={finish} aria-label="Skip" className="absolute right-4 top-4" style={{ color: "var(--pc-text-secondary)" }}>
          <Dismiss24Regular />
        </button>

        <div className="flex items-center gap-3">
          {Icon ? <Icon fontSize={32} style={{ color: "var(--pc-accent)" }} /> : <Logo size={32} />}
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--pc-text)" }}>
            {slide.title}
          </h2>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: "var(--pc-text)" }}>
          {slide.body}
        </p>

        <div className="flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 20 : 6, background: i === step ? "var(--pc-accent)" : "var(--pc-border)" }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-0"
            style={{ borderColor: "var(--pc-border)", color: "var(--pc-text-secondary)" }}
          >
            <ChevronLeft16Regular />
            Back
          </button>

          {isLast ? (
            <button type="button" onClick={finish} className="rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--pc-accent)" }}>
              Get started
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(SLIDES.length - 1, s + 1))}
              className="flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
              style={{ background: "var(--pc-accent)" }}
            >
              Next
              <ChevronRight16Regular />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
