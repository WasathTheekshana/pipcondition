// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { usePipelineStore } from "../pipeline.store";

describe("usePipelineStore: corrupted parameter self-healing", () => {
  it("a wrong-shaped persisted parameter override (e.g. from an older, buggy UI control) is discarded in favor of the default, not left to crash the simulation", async () => {
    await usePipelineStore.getState().setFileContent(
      "azure-pipelines.yml",
      `parameters:
  - name: tags
    type: object
    default: [a, b]

stages:
  - stage: A
    condition: eq(join(',', parameters.tags), 'a,b')
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    );

    // Sanity: with a proper array, no error and the stage runs.
    expect(usePipelineStore.getState().runtimeError).toBeNull();
    expect(usePipelineStore.getState().report?.stages[0].result).toBe("Succeeded");

    // Simulate what the old broken multi-value UI control used to do (and what
    // a stale localStorage entry saved before that fix would still contain):
    // collapse a list-typed parameter's value down to a single plain string.
    await usePipelineStore.getState().setParameter("tags", "not-an-array");

    // The bad override is discarded and the declared default is used instead -
    // the simulation keeps working rather than erroring at all.
    expect(usePipelineStore.getState().runtimeError).toBeNull();
    expect(usePipelineStore.getState().report?.stages[0].result).toBe("Succeeded");
    expect(usePipelineStore.getState().templateDiagnostics.some((d) => d.severity === "warning" && /wrong shape/.test(d.message))).toBe(true);
  });
});

describe("usePipelineStore: recomputeRun error handling", () => {
  it("catches a genuinely unrecoverable runtime condition error into runtimeError instead of throwing", async () => {
    // Unlike parameters, mock variables have no declared type/shape to repair
    // against - variables['x'] is always a plain string, so join() on it is a
    // real, uncatchable-by-repair error the store must still degrade gracefully from.
    await usePipelineStore.getState().setFileContent(
      "azure-pipelines.yml",
      `stages:
  - stage: A
    condition: eq(join(',', variables['notAnArray']), 'x')
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    );

    expect(usePipelineStore.getState().runtimeError).toMatch(/array or object/);
    expect(usePipelineStore.getState().report).toBeNull();
  });
});
