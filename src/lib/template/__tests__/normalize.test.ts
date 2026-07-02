import { describe, expect, it } from "vitest";
import { normalizeToStages } from "../normalize";

describe("normalizeToStages", () => {
  it("passes through an explicit stages list unchanged", () => {
    const doc = { stages: [{ stage: "A" }, { stage: "B" }] };
    expect(normalizeToStages(doc)).toBe(doc.stages);
  });

  it("wraps a jobs-only document into one implicit stage", () => {
    const doc = { jobs: [{ job: "Build" }] };
    const stages = normalizeToStages(doc);
    expect(stages).toHaveLength(1);
    expect(stages[0]).toMatchObject({ stage: "__implicit", jobs: doc.jobs });
  });

  it("wraps a steps-only document into one implicit stage and job", () => {
    const doc = { steps: [{ script: "echo hi" }], pool: { vmImage: "ubuntu-latest" } };
    const stages = normalizeToStages(doc);
    expect(stages).toHaveLength(1);
    expect(stages[0].jobs).toHaveLength(1);
    const job = (stages[0].jobs as Record<string, unknown>[])[0];
    expect(job.steps).toBe(doc.steps);
    expect(job.pool).toEqual({ vmImage: "ubuntu-latest" });
  });

  it("returns an empty array for a document with none of stages/jobs/steps", () => {
    expect(normalizeToStages({ trigger: "none" })).toEqual([]);
  });
});
