import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { MockOutcome } from "@/lib/dag";
import type { TriggerReason } from "@/lib/trigger-simulation";

/**
 * Everything needed to reproduce a simulated run, packed entirely into the
 * URL - no server, no database. The whole payload lives in the URL's hash
 * fragment (`#s=...`), which browsers never send to a server on navigation,
 * so this works unmodified on pipcondition's static Vercel hosting.
 */
export interface SharedRunState {
  readonly files: Record<string, string>;
  readonly entryPath: string;
  /**
   * The full mock variables map, INCLUDING trigger-derived keys
   * (Build.SourceBranch etc.) - not re-derived from simulatedBranch/Reason on
   * load, since a user can add arbitrary custom variables via setVariable()
   * that aren't recoverable from the trigger fields alone. simulatedBranch/
   * Reason/TargetBranch are carried separately purely so the trigger
   * simulator UI shows the right values - they're not the source of truth here.
   */
  readonly variables: Record<string, string>;
  readonly parameters: Record<string, unknown>;
  readonly outcomeOverrides: Record<string, MockOutcome>;
  readonly stepOutputs: Record<string, Record<string, string>>;
  readonly excludedStages: string[];
  readonly simulatedBranch: string;
  readonly simulatedReason: TriggerReason;
  readonly simulatedTargetBranch: string;
}

const HASH_KEY = "s";
/** Bumped only if SharedRunState's shape changes incompatibly - lets decodeShareHash reject links from an old, incompatible version instead of silently mis-hydrating the store. */
const SCHEMA_VERSION = 1;

export function encodeShareState(state: SharedRunState): string {
  const payload = JSON.stringify({ v: SCHEMA_VERSION, state });
  return compressToEncodedURIComponent(payload);
}

/** Returns null for a missing/malformed/incompatible-version hash rather than throwing - a bad share link should fall back to the normal app, not crash it. */
export function decodeShareState(encoded: string): SharedRunState | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json) as { v?: unknown; state?: unknown };
    if (parsed.v !== SCHEMA_VERSION || !parsed.state || typeof parsed.state !== "object") return null;
    return parsed.state as SharedRunState;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: SharedRunState): string {
  const url = new URL(window.location.href);
  url.hash = `${HASH_KEY}=${encodeShareState(state)}`;
  return url.toString();
}

/** Reads a share payload out of the current page's URL hash, if present. */
export function readShareStateFromLocation(): SharedRunState | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const encoded = params.get(HASH_KEY);
  if (!encoded) return null;
  return decodeShareState(encoded);
}

/** Strips the share payload from the URL bar after it's been loaded, so further edits in the app don't keep pointing at (now-stale) shared state, and reloading doesn't re-hydrate over local changes. */
export function clearShareHash(): void {
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url.toString());
}
