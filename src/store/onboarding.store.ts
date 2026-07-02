import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  /** Persisted: whether the user has ever completed/dismissed the welcome guide. Drives auto-show on first visit only. */
  readonly hasSeenWelcome: boolean;
  /** Not persisted: whether the guide is showing right now. */
  readonly isOpen: boolean;
  openWelcome: () => void;
  completeWelcome: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenWelcome: false,
      isOpen: false,
      openWelcome: () => set({ isOpen: true }),
      completeWelcome: () => set({ isOpen: false, hasSeenWelcome: true }),
    }),
    {
      name: "pipcondition-onboarding",
      partialize: (state) => ({ hasSeenWelcome: state.hasSeenWelcome }),
    },
  ),
);
