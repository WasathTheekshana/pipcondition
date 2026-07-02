import { describe, expect, it } from "vitest";
import { resolvePipeline } from "../index";
import { createBrowserVfs } from "../vfs/browser-vfs";

describe("resolvePipeline: simple single-file pipeline", () => {
  it("resolves an explicit stages/jobs/steps pipeline with conditions and dependsOn", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
stages:
  - stage: Build
    jobs:
      - job: Compile
        steps:
          - script: echo building
  - stage: Deploy
    dependsOn: Build
    condition: eq(dependencies.Build.result, 'Succeeded')
    jobs:
      - job: Ship
        steps:
          - script: echo shipping
`,
    });

    const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(ir.stages).toHaveLength(2);
    expect(ir.stages[0]).toMatchObject({ name: "Build", dependsOn: undefined });
    expect(ir.stages[1]).toMatchObject({ name: "Deploy", dependsOn: ["Build"], condition: "eq(dependencies.Build.result, 'Succeeded')" });
    expect(ir.stages[0].jobs[0].steps[0]).toMatchObject({ kind: "script" });
  });

  it("wraps a steps-only file into an implicit stage/job", async () => {
    const vfs = createBrowserVfs({ "azure-pipelines.yml": `steps:\n  - script: echo hi\n` });
    const { ir } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(ir.stages).toHaveLength(1);
    expect(ir.stages[0].jobs).toHaveLength(1);
    expect(ir.stages[0].jobs[0].steps).toHaveLength(1);
  });

  it("preserves the distinction between omitted dependsOn and explicit empty dependsOn", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
stages:
  - stage: A
    jobs: [{ job: J, steps: [{ script: echo }] }]
  - stage: B
    dependsOn: []
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });
    const { ir } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(ir.stages[0].dependsOn).toBeUndefined();
    expect(ir.stages[1].dependsOn).toEqual([]);
  });
});

describe("resolvePipeline: template: references", () => {
  it("inlines a steps-level template with parameters", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
steps:
  - template: templates/build-steps.yml
    parameters:
      buildConfig: Release
`,
      "templates/build-steps.yml": `
parameters:
  - name: buildConfig
    type: string
    default: Debug
steps:
  - script: build \${{ parameters.buildConfig }}
`,
    });

    const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const steps = ir.stages[0].jobs[0].steps;
    expect(steps).toHaveLength(1);
    expect(steps[0].raw.script).toBe("build Release");
  });

  it("inlines a jobs-level and stages-level template, resolving relative paths from the referencing file", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
stages:
  - template: stages/deploy-stage.yml
    parameters:
      envName: prod
`,
      "stages/deploy-stage.yml": `
parameters:
  - name: envName
    type: string
stages:
  - stage: Deploy_\${{ parameters.envName }}
    jobs:
      - template: ../jobs/deploy-job.yml
        parameters:
          envName: \${{ parameters.envName }}
`,
      "jobs/deploy-job.yml": `
parameters:
  - name: envName
    type: string
jobs:
  - job: Deploy
    steps:
      - script: deploy to \${{ parameters.envName }}
`,
    });

    const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(ir.stages).toHaveLength(1);
    expect(ir.stages[0].name).toBe("Deploy_prod");
    expect(ir.stages[0].jobs[0].name).toBe("Deploy");
    expect(ir.stages[0].jobs[0].steps[0].raw.script).toBe("deploy to prod");
  });

  it("reports a diagnostic and treats a self-referencing cycle as empty instead of hanging", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
steps:
  - template: templates/a.yml
`,
      "templates/a.yml": `
steps:
  - template: a.yml
`,
    });

    const { diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.some((d) => d.severity === "error" && /Circular template reference/.test(d.message))).toBe(true);
  });

  it("reports a diagnostic when a referenced template file is missing, instead of crashing the whole resolution", async () => {
    const vfs = createBrowserVfs({ "azure-pipelines.yml": `steps:\n  - template: templates/missing.yml\n` });
    const { diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.some((d) => d.severity === "error" && /file not found/.test(d.message))).toBe(true);
  });
});

describe("resolvePipeline: extends", () => {
  it("delegates the whole pipeline to the base template with passed parameters", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
extends:
  template: base.yml
  parameters:
    environment: prod
`,
      "base.yml": `
parameters:
  - name: environment
    type: string
    default: dev
stages:
  - stage: Deploy_\${{ parameters.environment }}
    jobs:
      - job: Ship
        steps:
          - script: ship to \${{ parameters.environment }}
`,
    });

    const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(ir.stages[0].name).toBe("Deploy_prod");
    expect(ir.stages[0].jobs[0].steps[0].raw.script).toBe("ship to prod");
  });

  it("exposes the ENTRY file's own declared parameters, not the base template's", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
parameters:
  - name: targetEnv
    type: string
    default: dev
    values: [dev, prod]
extends:
  template: base.yml
  parameters:
    environment: \${{ parameters.targetEnv }}
`,
      "base.yml": `
parameters:
  - name: environment
    type: string
stages:
  - stage: Deploy
    jobs: [{ job: Ship, steps: [{ script: echo }] }]
`,
    });

    const { parameterDeclarations } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(parameterDeclarations).toEqual([{ name: "targetEnv", type: "string", default: "dev", values: ["dev", "prod"] }]);
  });
});

describe("resolvePipeline: parameterDeclarations", () => {
  it("exposes the root pipeline's declared parameters for a Run-pipeline-style UI", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
parameters:
  - name: runTests
    type: boolean
    default: true
  - name: environment
    type: string
    values: [dev, staging, prod]
stages:
  - stage: Build
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });

    const { parameterDeclarations } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(parameterDeclarations).toEqual([
      { name: "runTests", type: "boolean", default: true, values: undefined },
      { name: "environment", type: "string", default: undefined, values: ["dev", "staging", "prod"] },
    ]);
  });

  it("returns an empty array when the pipeline declares no parameters", async () => {
    const vfs = createBrowserVfs({ "azure-pipelines.yml": `steps:\n  - script: echo\n` });
    const { parameterDeclarations } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(parameterDeclarations).toEqual([]);
  });
});

describe("resolvePipeline: ${{ if }} controlling which stages/steps exist", () => {
  it("includes a stage only when the root parameter condition is true", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
parameters:
  - name: runTests
    type: boolean
    default: true
stages:
  - stage: Build
    jobs: [{ job: J, steps: [{ script: echo }] }]
  - \${{ if eq(parameters.runTests, true) }}:
    - stage: Test
      jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });

    const withTests = await resolvePipeline("azure-pipelines.yml", vfs, { parameters: { runTests: true } });
    expect(withTests.ir.stages.map((s) => s.name)).toEqual(["Build", "Test"]);

    const withoutTests = await resolvePipeline("azure-pipelines.yml", vfs, { parameters: { runTests: false } });
    expect(withoutTests.ir.stages.map((s) => s.name)).toEqual(["Build"]);
  });
});
