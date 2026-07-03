import { APP_VERSION } from "@/lib/version";

const NEW_ISSUE_URL = "https://github.com/WasathTheekshana/pipcondition/issues/new";

export function BetaBanner() {
  return (
    <div className="flex h-8 shrink-0 items-center justify-center gap-2 px-4 text-xs font-medium" style={{ background: "var(--pc-warning-bg)", color: "var(--pc-warning)" }}>
      <span className="rounded-full border px-2 py-0.5 font-semibold" style={{ borderColor: "var(--pc-warning)" }}>
        BETA
      </span>
      <span>
        v{APP_VERSION} &mdash; things may be rough around the edges. Found a bug or missing a feature?{" "}
        <a href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer" className="underline">
          Open an issue
        </a>
        .
      </span>
    </div>
  );
}
