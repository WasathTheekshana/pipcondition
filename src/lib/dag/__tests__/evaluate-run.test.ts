import { describe, expect, it } from "vitest";
import { runSimulation } from "../index";
import { stage, job, step, pipeline } from "./helpers";

function resultOf(report: ReturnType<typeof runSimulation>["report"], stageName: string, jobName?: string, stepName?: string) {
  const s = report.stages.find((st) => st.name === stageName)!;
  if (!jobName) return s.result;
  const j = s.jobs.find((jb) => jb.name === jobName)!;
  if (!stepName) return j.result;
  return j.steps.find((st) => st.name === stepName)!.result;
}

describe("simulateRun: everything succeeds by default", () => {
  it("runs a simple linear pipeline end to end", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "echo" })] })] }),
      stage({ name: "Deploy", jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report, diagnostics } = runSimulation(ir);
    expect(diagnostics).toEqual([]);
    expect(resultOf(report, "Build")).toBe("Succeeded");
    expect(resultOf(report, "Deploy")).toBe("Succeeded");
  });
});

describe("simulateRun: fan-out/fan-in", () => {
  it("runs parallel jobs and a fan-in job that depends on both", () => {
    const ir = pipeline([
      stage({
        name: "S",
        jobs: [
          job({ name: "A", steps: [step({ name: "echo" })] }),
          job({ name: "B", steps: [step({ name: "echo" })] }),
          job({ name: "Combine", dependsOn: ["A", "B"], steps: [step({ name: "echo" })] }),
        ],
      }),
    ]);
    const { report } = runSimulation(ir);
    expect(resultOf(report, "S", "A")).toBe("Succeeded");
    expect(resultOf(report, "S", "B")).toBe("Succeeded");
    expect(resultOf(report, "S", "Combine")).toBe("Succeeded");
  });
});

describe("simulateRun: failure propagation", () => {
  it("a failed step fails its job, which skips the default-condition downstream stage", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "fail-step" })] })] }),
      stage({ name: "Deploy", jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report } = runSimulation(ir, { outcomeOverrides: { "Build/Compile/fail-step#0": "Failed" } });

    expect(resultOf(report, "Build", "Compile", "fail-step")).toBe("Failed");
    expect(resultOf(report, "Build", "Compile")).toBe("Failed");
    expect(resultOf(report, "Build")).toBe("Failed");
    expect(resultOf(report, "Deploy")).toBe("Skipped");
    const deployStage = report.stages.find((s) => s.name === "Deploy")!;
    expect(deployStage.skippedReason).toBe("dependency-failed-no-override");
  });

  it("continueOnError on a failing step yields SucceededWithIssues and lets default-condition downstream still run", () => {
    const ir = pipeline([
      stage({
        name: "Build",
        jobs: [job({ name: "Compile", steps: [step({ name: "flaky-step", continueOnError: true }), step({ name: "next-step" })] })],
      }),
      stage({ name: "Deploy", jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report } = runSimulation(ir, { outcomeOverrides: { "Build/Compile/flaky-step#0": "Failed" } });

    expect(resultOf(report, "Build", "Compile")).toBe("SucceededWithIssues");
    expect(resultOf(report, "Build")).toBe("SucceededWithIssues");
    // succeeded() treats SucceededWithIssues as success-like, so Deploy's default condition still evaluates true.
    expect(resultOf(report, "Deploy")).toBe("Succeeded");
  });
});

describe("simulateRun: always() overrides failure propagation", () => {
  it("a stage with condition always() still runs after an upstream failure", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "fail-step" })] })] }),
      stage({ name: "Notify", condition: "always()", jobs: [job({ name: "Send", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report } = runSimulation(ir, { outcomeOverrides: { "Build/Compile/fail-step#0": "Failed" } });

    expect(resultOf(report, "Build")).toBe("Failed");
    expect(resultOf(report, "Notify")).toBe("Succeeded");
  });
});

describe("simulateRun: dependencies.*.outputs across stages", () => {
  it("exposes a step's declared output to a downstream stage's condition via dependencies.<stage>.outputs", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "set-flag" })] })] }),
      stage({
        name: "Deploy",
        condition: "eq(dependencies.Build.outputs['Compile.set-flag.shouldDeploy'], 'true')",
        jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })],
      }),
    ]);
    const { report } = runSimulation(ir, { stepOutputs: { "Build/Compile/set-flag#0": { shouldDeploy: "true" } } });
    expect(resultOf(report, "Deploy")).toBe("Succeeded");

    const { report: reportFalse } = runSimulation(ir, { stepOutputs: { "Build/Compile/set-flag#0": { shouldDeploy: "false" } } });
    expect(resultOf(reportFalse, "Deploy")).toBe("Skipped");
  });

  it("exposes a job's outputs to another job in a dependent stage via stageDependencies", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "set-version" })] })] }),
      stage({
        name: "Deploy",
        jobs: [
          job({
            name: "Ship",
            condition: "eq(stageDependencies.Build.Compile.outputs['set-version.version'], '1.2.3')",
            steps: [step({ name: "echo" })],
          }),
        ],
      }),
    ]);
    const { report } = runSimulation(ir, { stepOutputs: { "Build/Compile/set-version#0": { version: "1.2.3" } } });
    expect(resultOf(report, "Deploy", "Ship")).toBe("Succeeded");
  });
});

describe("simulateRun: mock outcome overrides at every level", () => {
  it("forces a job's result directly, bypassing its normal rollup", () => {
    const ir = pipeline([stage({ name: "S", jobs: [job({ name: "J", steps: [step({ name: "echo" })] })] })]);
    const { report } = runSimulation(ir, { outcomeOverrides: { "S/J": "Failed" } });
    expect(resultOf(report, "S", "J")).toBe("Failed");
    // steps underneath still evaluate/report their own natural result even though the job's rolled-up result was overridden
    expect(resultOf(report, "S", "J", "echo")).toBe("Succeeded");
  });

  it("an override on a node whose condition evaluates false has no effect - it stays Skipped", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "fail-step" })] })] }),
      stage({ name: "Deploy", jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report } = runSimulation(ir, {
      outcomeOverrides: { "Build/Compile/fail-step#0": "Failed", Deploy: "Succeeded" },
    });
    expect(resultOf(report, "Deploy")).toBe("Skipped");
  });
});

describe("simulateRun: variables in conditions", () => {
  it("evaluates a condition against mock pipeline-level variables", () => {
    const ir = pipeline([
      stage({
        name: "Deploy",
        condition: "eq(variables['Build.Reason'], 'PullRequest')",
        jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })],
      }),
    ]);
    const prRun = runSimulation(ir, { variables: { "Build.Reason": "PullRequest" } });
    expect(resultOf(prRun.report, "Deploy")).toBe("Succeeded");

    const manualRun = runSimulation(ir, { variables: { "Build.Reason": "Manual" } });
    expect(resultOf(manualRun.report, "Deploy")).toBe("Skipped");
  });
});

describe("simulateRun: excludedStages (\"stages to run\" checkbox selection)", () => {
  it("forces a deselected stage to Skipped regardless of what its own condition would evaluate to", () => {
    const ir = pipeline([stage({ name: "Deploy", condition: "true" })]);
    const { report } = runSimulation(ir, { excludedStages: ["Deploy"] });
    const deploy = report.stages.find((s) => s.name === "Deploy")!;
    expect(deploy.result).toBe("Skipped");
    expect(deploy.skippedReason).toBe("not-selected");
    // the condition trace is still computed for display, but doesn't drive the outcome
    expect(deploy.conditionResult).toBe(false);
  });

  it("cascades: deselecting a stage skips everything that depends on it by default", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "echo" })] })] }),
      stage({ name: "Deploy", jobs: [job({ name: "Ship", steps: [step({ name: "echo" })] })] }),
      stage({ name: "Notify", jobs: [job({ name: "Send", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report } = runSimulation(ir, { excludedStages: ["Build"] });

    expect(resultOf(report, "Build")).toBe("Skipped");
    const deploy = report.stages.find((s) => s.name === "Deploy")!;
    expect(deploy.result).toBe("Skipped");
    expect(deploy.skippedReason).toBe("dependency-skipped");
    const notify = report.stages.find((s) => s.name === "Notify")!;
    expect(notify.result).toBe("Skipped");
    expect(notify.skippedReason).toBe("dependency-skipped");
  });

  it("always() still overrides the cascade even when the upstream stage was deselected", () => {
    const ir = pipeline([
      stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "echo" })] })] }),
      stage({ name: "Notify", condition: "always()", jobs: [job({ name: "Send", steps: [step({ name: "echo" })] })] }),
    ]);
    const { report } = runSimulation(ir, { excludedStages: ["Build"] });
    expect(resultOf(report, "Notify")).toBe("Succeeded");
  });

  it("a stage not in excludedStages runs normally", () => {
    const ir = pipeline([stage({ name: "Build", jobs: [job({ name: "Compile", steps: [step({ name: "echo" })] })] })]);
    const { report } = runSimulation(ir, { excludedStages: ["SomeOtherStage"] });
    expect(resultOf(report, "Build")).toBe("Succeeded");
  });
});
