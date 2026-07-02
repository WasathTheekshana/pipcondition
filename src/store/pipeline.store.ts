import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { castDraft } from "immer";
import { createBrowserVfs, resolvePipeline } from "@/lib/template";
import type { PipelineIR, Diagnostic, ParameterDeclaration } from "@/lib/template";
import { buildGraph, simulateRun } from "@/lib/dag";
import type { PipelineGraph, RunReport, MockOutcome } from "@/lib/dag";

const ENTRY_FILE_NAME = "azure-pipelines.yml";

export const DEFAULT_YAML = `parameters:
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

interface PipelineState {
  /** path -> file content, the in-browser "repo" the template resolver reads from. */
  readonly files: Record<string, string>;
  readonly entryPath: string;
  /** Which file the editor is currently showing/editing - independent of entryPath, since template files can be edited too. */
  readonly activeFilePath: string;
  /** False until the first real drag-drop import - lets addFiles() replace the built-in demo instead of merging alongside it. */
  readonly hasImportedFiles: boolean;

  readonly ir: PipelineIR | null;
  readonly graph: PipelineGraph | null;
  readonly report: RunReport | null;
  readonly parameterDeclarations: readonly ParameterDeclaration[];
  readonly templateDiagnostics: readonly Diagnostic[];
  readonly dagDiagnostics: readonly Diagnostic[];
  readonly parseError: string | null;
  readonly isResolving: boolean;

  readonly variables: Record<string, string>;
  readonly parameters: Record<string, unknown>;
  readonly outcomeOverrides: Record<string, MockOutcome>;
  readonly stepOutputs: Record<string, Record<string, string>>;
  /** Stage ids deselected via the "stages to run" picker - mirrors Azure's Run-pipeline dialog. */
  readonly excludedStages: string[];

  /** Resolves+simulates the current file set. Call once on mount; every mutating action already re-triggers this itself. */
  initialize: () => Promise<void>;
  setFileContent: (path: string, text: string) => Promise<void>;
  addFiles: (files: Readonly<Record<string, string>>) => Promise<void>;
  removeFile: (path: string) => Promise<void>;
  setEntryPath: (path: string) => Promise<void>;
  setActiveFilePath: (path: string) => void;
  setVariable: (name: string, value: string) => Promise<void>;
  removeVariable: (name: string) => Promise<void>;
  setParameter: (name: string, value: unknown) => Promise<void>;
  setOutcomeOverride: (nodeId: string, outcome: MockOutcome) => void;
  setStepOutput: (stepId: string, varName: string, value: string) => void;
  removeStepOutput: (stepId: string, varName: string) => void;
  toggleStageExcluded: (stageId: string) => void;
  /** Wipes all saved files and mock run configuration from localStorage and resets to the built-in demo pipeline. */
  clearAllData: () => Promise<void>;
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    immer((set) => ({
      files: { [ENTRY_FILE_NAME]: DEFAULT_YAML },
      entryPath: ENTRY_FILE_NAME,
      activeFilePath: ENTRY_FILE_NAME,
      hasImportedFiles: false,

      ir: null,
      graph: null,
      report: null,
      parameterDeclarations: [],
      templateDiagnostics: [],
      dagDiagnostics: [],
      parseError: null,
      isResolving: false,

      variables: {},
      parameters: {},
      outcomeOverrides: {},
      stepOutputs: {},
      excludedStages: [],

      initialize: async () => {
        await resolveAndRecompute();
      },

      setFileContent: async (path, text) => {
        set((state) => {
          state.files[path] = text;
        });
        await resolveAndRecompute();
      },

      addFiles: async (newFiles) => {
        set((state) => {
          const isFirstImport = !state.hasImportedFiles;
          if (isFirstImport) {
            // Replace the built-in demo entirely rather than merging alongside it.
            state.files = castDraft(newFiles) as Record<string, string>;
            state.hasImportedFiles = true;
          } else {
            for (const [path, content] of Object.entries(newFiles)) {
              state.files[path] = content;
            }
          }

          if (isFirstImport || !(state.entryPath in state.files)) {
            const candidate = Object.keys(newFiles).find((p) => p.toLowerCase().endsWith(ENTRY_FILE_NAME)) ?? Object.keys(state.files)[0];
            if (candidate) {
              state.entryPath = candidate;
              state.activeFilePath = candidate;
            }
          }
        });
        await resolveAndRecompute();
      },

      removeFile: async (path) => {
        set((state) => {
          delete state.files[path];
          const remaining = Object.keys(state.files);
          if (state.entryPath === path) state.entryPath = remaining[0] ?? "";
          if (state.activeFilePath === path) state.activeFilePath = remaining[0] ?? "";
        });
        await resolveAndRecompute();
      },

      setEntryPath: async (path) => {
        set((state) => {
          state.entryPath = path;
        });
        await resolveAndRecompute();
      },

      setActiveFilePath: (path) => {
        set((state) => {
          state.activeFilePath = path;
        });
      },

      setVariable: async (name, value) => {
        set((state) => {
          state.variables[name] = value;
        });
        await resolveAndRecompute();
      },

      removeVariable: async (name) => {
        set((state) => {
          delete state.variables[name];
        });
        await resolveAndRecompute();
      },

      setParameter: async (name, value) => {
        set((state) => {
          state.parameters[name] = castDraft(value);
        });
        await resolveAndRecompute();
      },

      setOutcomeOverride: (nodeId, outcome) => {
        set((state) => {
          if (outcome === "inherit") delete state.outcomeOverrides[nodeId];
          else state.outcomeOverrides[nodeId] = outcome;
        });
        recomputeRun();
      },

      setStepOutput: (stepId, varName, value) => {
        set((state) => {
          state.stepOutputs[stepId] ??= {};
          state.stepOutputs[stepId][varName] = value;
        });
        recomputeRun();
      },

      removeStepOutput: (stepId, varName) => {
        set((state) => {
          delete state.stepOutputs[stepId]?.[varName];
        });
        recomputeRun();
      },

      toggleStageExcluded: (stageId) => {
        set((state) => {
          const i = state.excludedStages.indexOf(stageId);
          if (i === -1) state.excludedStages.push(stageId);
          else state.excludedStages.splice(i, 1);
        });
        recomputeRun();
      },

      clearAllData: async () => {
        set((state) => {
          state.files = { [ENTRY_FILE_NAME]: DEFAULT_YAML };
          state.entryPath = ENTRY_FILE_NAME;
          state.activeFilePath = ENTRY_FILE_NAME;
          state.hasImportedFiles = false;
          state.variables = {};
          state.parameters = {};
          state.outcomeOverrides = {};
          state.stepOutputs = {};
          state.excludedStages = [];
        });
        await resolveAndRecompute();
      },
    })),
    {
      name: "pipcondition-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist the developer's actual input - files and mock run config.
      // Derived state (ir/graph/report/diagnostics) is always recomputed fresh on load.
      partialize: (state) => ({
        files: state.files,
        entryPath: state.entryPath,
        activeFilePath: state.activeFilePath,
        hasImportedFiles: state.hasImportedFiles,
        variables: state.variables,
        parameters: state.parameters,
        outcomeOverrides: state.outcomeOverrides,
        stepOutputs: state.stepOutputs,
        excludedStages: state.excludedStages,
      }),
    },
  ),
);

/** Variables and parameters both feed compile-time `${{ }}` template expansion as well as runtime condition evaluation, so changing either requires a full re-resolve, not just re-simulating the DAG. */
async function resolveAndRecompute(): Promise<void> {
  const { files, entryPath, variables, parameters } = usePipelineStore.getState();
  usePipelineStore.setState({ isResolving: true, parseError: null });

  if (!entryPath || !(entryPath in files)) {
    usePipelineStore.setState({ ir: null, parseError: "No entry pipeline file selected.", isResolving: false });
    recomputeRun();
    return;
  }

  try {
    const vfs = createBrowserVfs(files);
    const { ir, diagnostics, parameterDeclarations } = await resolvePipeline(entryPath, vfs, {
      variables,
      parameters,
    });
    usePipelineStore.setState({
      ir: castDraft(ir),
      templateDiagnostics: castDraft(diagnostics),
      parameterDeclarations: castDraft(parameterDeclarations),
      isResolving: false,
    });
  } catch (err) {
    usePipelineStore.setState({
      ir: null,
      parseError: err instanceof Error ? err.message : String(err),
      isResolving: false,
    });
  }

  recomputeRun();
}

function recomputeRun(): void {
  const { ir, variables, parameters, outcomeOverrides, stepOutputs, excludedStages } = usePipelineStore.getState();
  if (!ir) {
    usePipelineStore.setState({ graph: null, report: null, dagDiagnostics: [] });
    return;
  }
  const dagDiagnostics: Diagnostic[] = [];
  const graph = buildGraph(ir, dagDiagnostics);
  const report = simulateRun(graph, { variables, parameters, outcomeOverrides, stepOutputs, excludedStages });
  usePipelineStore.setState({ graph, report, dagDiagnostics });
}
