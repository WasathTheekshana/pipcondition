// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { compressToEncodedURIComponent } from "lz-string";
import { encodeShareState, decodeShareState, buildShareUrl, readShareStateFromLocation, clearShareHash, type SharedRunState } from "../share-link";

function sampleState(overrides: Partial<SharedRunState> = {}): SharedRunState {
  return {
    files: { "azure-pipelines.yml": "stages:\n  - stage: A\n    jobs: []\n" },
    entryPath: "azure-pipelines.yml",
    variables: { "Build.SourceBranch": "refs/heads/main", "Build.Reason": "Manual", MyCustomVar: "hello" },
    parameters: { runTests: true, tags: ["a", "b"] },
    outcomeOverrides: { stageA: "Failed" },
    stepOutputs: { step1: { out: "value" } },
    excludedStages: ["stageB"],
    simulatedBranch: "main",
    simulatedReason: "Manual",
    simulatedTargetBranch: "main",
    ...overrides,
  };
}

describe("encodeShareState / decodeShareState", () => {
  it("round-trips a typical state exactly", () => {
    const state = sampleState();
    const decoded = decodeShareState(encodeShareState(state));
    expect(decoded).toEqual(state);
  });

  it("round-trips an empty/minimal state", () => {
    const state = sampleState({ files: {}, variables: {}, parameters: {}, outcomeOverrides: {}, stepOutputs: {}, excludedStages: [] });
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  it("round-trips special characters in YAML content (quotes, unicode, newlines, ${{ }})", () => {
    const state = sampleState({
      files: {
        "azure-pipelines.yml": "stages:\n  - stage: \"Ünïcödé 🚀\"\n    condition: eq('${{ parameters.x }}', \"y's \\\"z\\\"\")\n",
      },
    });
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  it("round-trips a large multi-file pipeline (compression doesn't corrupt bigger payloads)", () => {
    const bigFile = "stages:\n" + Array.from({ length: 200 }, (_, i) => `  - stage: Stage${i}\n    jobs: [{ job: J, steps: [{ script: echo ${i} }] }]\n`).join("");
    const state = sampleState({ files: { "azure-pipelines.yml": bigFile, "templates/a.yml": bigFile, "templates/b.yml": bigFile } });
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  it("returns null for garbage input instead of throwing", () => {
    expect(decodeShareState("not-a-valid-payload-at-all-%%%")).toBeNull();
    expect(decodeShareState("")).toBeNull();
  });

  it("returns null for a well-formed but unrelated JSON payload smuggled through the same compression", () => {
    const encoded = encodeShareState(sampleState());
    // Corrupt just the version marker by re-encoding a different shape entirely.
    const wrongShape = JSON.stringify({ v: 1, state: "not-an-object" });
    expect(decodeShareState(compressToEncodedURIComponent(wrongShape))).toBeNull();
    expect(encoded).not.toBe("");
  });

  it("returns null for a payload with a mismatched schema version", () => {
    const encoded = compressToEncodedURIComponent(JSON.stringify({ v: 999, state: sampleState() }));
    expect(decodeShareState(encoded)).toBeNull();
  });

  it("returns null for a payload missing the state field entirely", () => {
    const encoded = compressToEncodedURIComponent(JSON.stringify({ v: 1 }));
    expect(decodeShareState(encoded)).toBeNull();
  });
});

describe("buildShareUrl / readShareStateFromLocation / clearShareHash", () => {
  it("builds a URL whose hash decodes back to the original state, preserving the current path", () => {
    window.history.replaceState(null, "", "/some/path?existing=1");
    const state = sampleState();
    const url = buildShareUrl(state);
    expect(url).toContain("/some/path");
    expect(url).toContain("#s=");

    const parsed = new URL(url);
    window.history.replaceState(null, "", parsed.pathname + parsed.search + parsed.hash);
    expect(readShareStateFromLocation()).toEqual(state);
  });

  it("readShareStateFromLocation returns null when there is no share hash", () => {
    window.history.replaceState(null, "", "/");
    expect(readShareStateFromLocation()).toBeNull();
  });

  it("readShareStateFromLocation returns null for an unrelated hash fragment", () => {
    window.history.replaceState(null, "", "/#some-other-anchor");
    expect(readShareStateFromLocation()).toBeNull();
  });

  it("clearShareHash removes the hash but keeps the path and query", () => {
    window.history.replaceState(null, "", "/app?x=1#s=abc123");
    clearShareHash();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/app");
    expect(window.location.search).toBe("?x=1");
  });
});
