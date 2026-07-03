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

  // Regression: `resolvedParameters` (declared defaults merged with overrides)
  // is what the DAG engine uses for runtime `condition:` evaluation. Without
  // it, a condition referencing a parameter the user never touched in the
  // "Run parameters" UI would throw "unknown parameter" despite it having a
  // perfectly valid default.
  it("exposes resolvedParameters with declared defaults filled in, even when nothing was overridden", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
parameters:
  - name: runTests
    type: boolean
    default: true
  - name: tags
    type: object
    default: [a, b]
stages:
  - stage: Build
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });

    const { resolvedParameters } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(resolvedParameters).toEqual({ runTests: true, tags: ["a", "b"] });
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

// Regression coverage for a real enterprise pipeline pattern that used to
// throw entirely: array-form `variables:` with a conditional pool selection,
// a variable group reference, and root-level variables cascading to stages.
describe("resolvePipeline: array-form variables (real-world pattern)", () => {
  it("resolves name/value variable list items, including inside ${{ if/elseif/else }} branches", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
variables:
  - name: dotnetVersion
    value: "10.0.x"
  - group: finance-devops

stages:
  - stage: build
    variables:
      - \${{ if eq(variables['Build.SourceBranch'], 'refs/heads/main') }}:
          - name: pool
            value: "PROD-POOL"
      - \${{ else }}:
          - name: pool
            value: "DEV-POOL"
    jobs:
      - job: J
        steps:
          - script: echo hi
`,
    });

    const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs, { variables: { "Build.SourceBranch": "refs/heads/main" } });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    // root-level variable cascades down, plus the chosen ${{ if }} branch's variable
    expect(ir.stages[0].variables).toEqual({ dotnetVersion: "10.0.x", pool: "PROD-POOL" });
    // an unresolvable variable group produces a warning, not a crash
    expect(diagnostics.some((d) => d.severity === "warning" && /Variable group 'finance-devops'/.test(d.message))).toBe(true);
  });

  it("cascades root-level variables to every stage, with each stage's own variables overriding on collision", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
variables:
  - name: shared
    value: "root-value"
  - name: overridden
    value: "root-value"

stages:
  - stage: A
    jobs: [{ job: J, steps: [{ script: echo }] }]
  - stage: B
    variables:
      - name: overridden
        value: "stage-value"
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });

    const { ir } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(ir.stages[0].variables).toEqual({ shared: "root-value", overridden: "root-value" });
    expect(ir.stages[1].variables).toEqual({ shared: "root-value", overridden: "stage-value" });
  });

  it("does not error when a ${{ if }} condition inside a variables block references an unset built-in variable", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `
stages:
  - stage: A
    variables:
      - \${{ if startsWith(variables['Build.SourceBranch'], 'refs/heads/release') }}:
          - name: pool
            value: "RELEASE-POOL"
      - \${{ else }}:
          - name: pool
            value: "DEFAULT-POOL"
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });

    // No mock value provided for Build.SourceBranch at all - must resolve to "" like real Azure, not throw.
    const { ir, diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(ir.stages[0].variables.pool).toBe("DEFAULT-POOL");
  });
});

// The editor uses Diagnostic.line to underline the exact source line live,
// like a compiler - this locks in that raw YAML syntax errors (the case that
// can actually be pinned to a precise line) carry that field.
describe("resolvePipeline: YAML syntax errors carry a precise line number", () => {
  it("reports a bad-indentation error with its 1-based source line", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `stages:
  - stage: Build
    jobs:
      - job: J
        steps:
          - script: echo hi
      badly:
     indented: true
`,
    });

    const { diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    const parseError = diagnostics.find((d) => d.severity === "error" && /Failed to parse YAML/.test(d.message));
    expect(parseError).toBeDefined();
    expect(parseError!.line).toBeGreaterThan(0);
  });

  it("does not attach a line number to non-syntax diagnostics", async () => {
    const vfs = createBrowserVfs({
      "azure-pipelines.yml": `parameters:
  - name: env
    type: string
stages:
  - stage: A
    jobs: [{ job: J, steps: [{ script: echo }] }]
`,
    });

    const { diagnostics } = await resolvePipeline("azure-pipelines.yml", vfs);
    const missingParamError = diagnostics.find((d) => /Missing required parameter/.test(d.message));
    expect(missingParamError).toBeDefined();
    expect(missingParamError!.line).toBeUndefined();
  });
});
