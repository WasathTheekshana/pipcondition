import { describe, expect, it } from "vitest";
import { aggregateStatus, rollupResults } from "../status";

describe("aggregateStatus", () => {
  it("defaults to Succeeded with no dependencies", () => expect(aggregateStatus([])).toBe("Succeeded"));
  it("Canceled beats everything", () => expect(aggregateStatus(["Succeeded", "Failed", "Canceled"])).toBe("Canceled"));
  it("Failed beats SucceededWithIssues", () => expect(aggregateStatus(["Succeeded", "Failed"])).toBe("Failed"));
  it("all-Skipped aggregates to Skipped", () => expect(aggregateStatus(["Skipped", "Skipped"])).toBe("Skipped"));
  it("a mix of Succeeded and Skipped is not Skipped", () => expect(aggregateStatus(["Succeeded", "Skipped"])).toBe("Succeeded"));
  it("SucceededWithIssues if present and nothing worse", () => expect(aggregateStatus(["Succeeded", "SucceededWithIssues"])).toBe("SucceededWithIssues"));
});

describe("rollupResults", () => {
  it("Succeeded when all children succeed", () => expect(rollupResults(["Succeeded", "Succeeded"])).toBe("Succeeded"));
  it("Failed when any child fails without continueOnError", () => expect(rollupResults(["Succeeded", "Failed"], [false, false])).toBe("Failed"));
  it("SucceededWithIssues when a failing child has continueOnError", () => expect(rollupResults(["Succeeded", "Failed"], [false, true])).toBe("SucceededWithIssues"));
  it("Canceled beats Failed", () => expect(rollupResults(["Failed", "Canceled"], [false, false])).toBe("Canceled"));
  it("all-Skipped rolls up to Skipped", () => expect(rollupResults(["Skipped", "Skipped"])).toBe("Skipped"));
  it("a mix of Succeeded and Skipped rolls up to Succeeded", () => expect(rollupResults(["Succeeded", "Skipped"])).toBe("Succeeded"));
});
