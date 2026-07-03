export interface ExamplePipeline {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly yaml: string;
}

const BASIC_YAML = `parameters:
  - name: runTests
    type: boolean
    default: true
  - name: targetEnv
    type: string
    default: staging
    values:
      - staging
      - prod

stages:
  - stage: Build
    jobs:
      - job: Compile
        steps:
          - script: echo "building"
            name: build_step

  - stage: Test
    dependsOn: Build
    condition: and(eq(dependencies.Build.result, 'Succeeded'), eq(\${{ parameters.runTests }}, true))
    jobs:
      - job: RunTests
        steps:
          - script: echo "testing"
            name: test_step

  - stage: Deploy
    dependsOn:
      - Build
      - Test
    condition: |
      and(
        in(dependencies.Build.result, 'Succeeded', 'SucceededWithIssues'),
        in(dependencies.Test.result, 'Succeeded', 'SucceededWithIssues', 'Skipped')
      )
    variables:
      environment: \${{ parameters.targetEnv }}
    jobs:
      - job: Ship
        steps:
          - script: echo "shipping to $(environment)"
            name: ship_step
`;

const ADVANCED_CONDITIONS_YAML = `# =====================================================================
# ADVANCED PIPELINE - STAGE CONDITION STRESS TEST
# Exercises compile-time (\${{ }}) and runtime ($[ ], condition:) expressions,
# nested boolean functions, cross-stage dependsOn fan-out/fan-in, matrix
# strategies, deployment jobs, and a templated multi-region rollout.
# =====================================================================

parameters:
  - name: environment
    displayName: Target Environment
    type: string
    default: dev
    values:
      - dev
      - test
      - staging
      - prod

  - name: runIntegrationTests
    displayName: Run Integration Tests
    type: boolean
    default: true

  - name: deployRegions
    displayName: Deploy Regions
    type: object
    default:
      - name: eastus
        primary: true
      - name: westeurope
        primary: false

  - name: skipStages
    displayName: Comma separated stages to skip
    type: string
    default: ''

variables:
  - name: isMain
    value: $[eq(variables['Build.SourceBranch'], 'refs/heads/main')]
  - name: isRelease
    value: $[startsWith(variables['Build.SourceBranch'], 'refs/heads/release/')]
  - \${{ if eq(parameters.environment, 'prod') }}:
      - name: deployRing
        value: 'ring3'
  - \${{ elseif eq(parameters.environment, 'staging') }}:
      - name: deployRing
        value: 'ring2'
  - \${{ else }}:
      - name: deployRing
        value: 'ring0'

stages:
  - \${{ if not(contains(parameters.skipStages, 'Build')) }}:
      - stage: Build
        displayName: 'Build & Package'
        condition: always()
        jobs:
          - job: Compile
            strategy:
              matrix:
                linux_x64:
                  imageName: 'ubuntu-latest'
                windows_x64:
                  imageName: 'windows-latest'
              maxParallel: 2
            pool:
              vmImage: $(imageName)
            steps:
              - script: echo "Building on $(imageName)"
          - job: StaticAnalysis
            dependsOn: []
            condition: |
              and(
                succeeded(),
                ne(variables['Build.Reason'], 'PullRequest')
              )
            steps:
              - script: echo "Running SAST / lint"

  - stage: UnitTests
    displayName: 'Unit Tests'
    dependsOn: Build
    condition: |
      and(
        in(dependencies.Build.result, 'Succeeded', 'SucceededWithIssues'),
        ne(variables['Build.Reason'], 'Schedule')
      )
    jobs:
      - job: RunUnitTests
        steps:
          - script: echo "dotnet test / npm test"

  - \${{ if eq(parameters.runIntegrationTests, true) }}:
      - stage: IntegrationTests
        displayName: 'Integration Tests'
        dependsOn:
          - Build
          - UnitTests
        condition: |
          and(
            succeeded('UnitTests'),
            or(
              eq(variables.isMain, 'True'),
              eq(variables.isRelease, 'True')
            ),
            ne(variables['Build.Reason'], 'PullRequest')
          )
        jobs:
          - job: SpinUpEnvironment
            steps:
              - script: echo "Provisioning ephemeral test environment"
          - job: ExecuteIntegrationSuite
            dependsOn: SpinUpEnvironment
            steps:
              - script: echo "Running integration suite"

  - stage: SecurityScan
    displayName: 'Security & Compliance Scan'
    dependsOn:
      - Build
      - UnitTests
      - \${{ if eq(parameters.runIntegrationTests, true) }}:
          - IntegrationTests
    condition: |
      and(
        not(canceled()),
        or(succeeded(), failed())
      )
    jobs:
      - job: DependencyScan
        steps:
          - script: echo "Scanning dependencies for CVEs"

  - \${{ each region in parameters.deployRegions }}:
      - stage: Deploy_\${{ region.name }}
        displayName: 'Deploy to \${{ region.name }}'
        dependsOn:
          - SecurityScan
          - \${{ if not(region.primary) }}:
              - Deploy_\${{ parameters.deployRegions[0].name }}
        condition: |
          and(
            succeeded('SecurityScan'),
            ne('\${{ parameters.environment }}', 'dev')
          )
        variables:
          regionName: \${{ region.name }}
        jobs:
          - deployment: DeployRegion
            displayName: 'Deploy \${{ region.name }} (\${{ parameters.environment }})'
            environment: '\${{ parameters.environment }}-\${{ region.name }}'
            strategy:
              runOnce:
                deploy:
                  steps:
                    - script: echo "Deploying to $(regionName), ring $(deployRing)"

  - stage: Rollback
    displayName: 'Automatic Rollback'
    dependsOn:
      - \${{ each region in parameters.deployRegions }}:
          - Deploy_\${{ region.name }}
    condition: |
      and(
        not(canceled()),
        or(
          eq(dependencies.Deploy_eastus.result, 'Failed'),
          eq(dependencies.Deploy_westeurope.result, 'Failed')
        )
      )
    jobs:
      - job: RevertLastKnownGood
        steps:
          - script: echo "Rolling back to last known good release"

  - stage: Notify
    displayName: 'Notify Stakeholders'
    dependsOn:
      - Build
      - UnitTests
      - \${{ if eq(parameters.runIntegrationTests, true) }}:
          - IntegrationTests
      - SecurityScan
      - \${{ each region in parameters.deployRegions }}:
          - Deploy_\${{ region.name }}
      - Rollback
    condition: always()
    jobs:
      - job: SendSummary
        steps:
          - script: echo "Pipeline finished with mixed conditional evaluation"
`;

const ENTERPRISE_VARIABLES_YAML = `# =====================================================================
# ENTERPRISE-STYLE VARIABLES
# Shows the array form of variables:, a branch-conditional variable
# block, a variable-group reference, and cross-repo job templates -
# the shape real Azure DevOps org pipelines usually take. The variable
# group and cross-repo templates can't be resolved without a live Azure
# DevOps connection, so the simulator reports them as warnings and keeps
# simulating everything it can - it won't crash on these.
# =====================================================================

variables:
  - name: dotnetVersion
    value: '8.0.x'
  - group: shared-secrets

stages:
  - stage: build
    displayName: Build
    variables:
      - \${{ if eq(variables['Build.SourceBranch'], 'refs/heads/main') }}:
          - name: pool
            value: 'PROD-POOL'
      - \${{ elseif startsWith(variables['Build.SourceBranch'], 'refs/heads/release') }}:
          - name: pool
            value: 'RELEASE-POOL'
      - \${{ else }}:
          - name: pool
            value: 'DEV-POOL'
    jobs:
      - job: Compile
        steps:
          - script: echo "Building with .NET $(dotnetVersion) on $(pool)"

  - stage: deploy
    displayName: Deploy
    dependsOn: build
    condition: |
      and(
        succeeded(),
        ne(variables['Build.Reason'], 'PullRequest')
      )
    jobs:
      - template: /templates/jobs/deploy/deploy-web-app.yml@DevOpsTemplates
        parameters:
          environment: production
`;

export const EXAMPLE_PIPELINES: readonly ExamplePipeline[] = [
  {
    id: "basic",
    name: "Basic: stages, dependsOn & conditions",
    description: "Three stages with a parameter-gated Test stage and a multi-dependency Deploy condition - the built-in demo.",
    yaml: BASIC_YAML,
  },
  {
    id: "advanced-conditions",
    name: "Advanced: nested conditions, matrix & each loops",
    description: "Compile-time and runtime expressions, a matrix strategy, deployment jobs, and a templated multi-region rollout generated with ${{ each }}.",
    yaml: ADVANCED_CONDITIONS_YAML,
  },
  {
    id: "enterprise-variables",
    name: "Enterprise-style: variable groups & cross-repo templates",
    description: "Array-form variables with a branch-conditional block, a variable group, and a cross-repo job template - shows how unresolvable references degrade to warnings instead of errors.",
    yaml: ENTERPRISE_VARIABLES_YAML,
  },
];
