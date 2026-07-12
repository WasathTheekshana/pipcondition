import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { castDraft } from "immer";
import { createBrowserVfs, resolvePipeline } from "@/lib/template";
import type { PipelineIR, Diagnostic, ParameterDeclaration } from "@/lib/template";
import { buildGraph, simulateRun } from "@/lib/dag";
import type { PipelineGraph, RunReport, MockOutcome } from "@/lib/dag";
import { EXAMPLE_PIPELINES } from "@/lib/examples";
import { deriveTriggerVariables, TRIGGER_VARIABLE_KEYS, type TriggerReason } from "@/lib/trigger-simulation";
import type { SharedRunState } from "@/lib/share-link";

const ENTRY_FILE_NAME = "azure-pipelines.yml";

export const DEFAULT_YAML = EXAMPLE_PIPELINES[0].yaml;

const DEFAULT_TRIGGER = { branch: "main", reason: "Manual" as TriggerReason, targetBranch: "main" };

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
  /** Declared defaults merged with `parameters` overrides - used for runtime condition evaluation so a parameter with a default "just works" without the user touching its UI control. */
  readonly resolvedParameters: Record<string, unknown>;
  readonly templateDiagnostics: readonly Diagnostic[];
  readonly dagDiagnostics: readonly Diagnostic[];
  readonly parseError: string | null;
  /** Set if simulating the run itself throws (distinct from parseError, which is template/YAML resolution failing). */
  readonly runtimeError: string | null;
  readonly isResolving: boolean;

  readonly variables: Record<string, string>;
  readonly parameters: Record<string, unknown>;
  readonly outcomeOverrides: Record<string, MockOutcome>;
  readonly stepOutputs: Record<string, Record<string, string>>;
  /** Stage ids deselected via the "stages to run" picker - mirrors Azure's Run-pipeline dialog. */
  readonly excludedStages: string[];

  /** The friendly branch/reason/target-branch inputs behind the derived Build.SourceBranch/Build.Reason/System.PullRequest.* entries in `variables`. */
  readonly simulatedBranch: string;
  readonly simulatedReason: TriggerReason;
  readonly simulatedTargetBranch: string;

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
  /** Updates the simulated branch push/PR trigger, deriving and setting Build.SourceBranch/Build.SourceBranchName/Build.Reason/System.PullRequest.* accordingly. */
  setTrigger: (trigger: { branch?: string; reason?: TriggerReason; targetBranch?: string }) => Promise<void>;
  setOutcomeOverride: (nodeId: string, outcome: MockOutcome) => void;
  setStepOutput: (stepId: string, varName: string, value: string) => void;
  removeStepOutput: (stepId: string, varName: string) => void;
  toggleStageExcluded: (stageId: string) => void;
  /** Wipes all saved files and mock run configuration from localStorage and resets to the built-in demo pipeline. */
  clearAllData: () => Promise<void>;
  /** Replaces the current file set with one of the bundled EXAMPLE_PIPELINES and resets mock run config, so switching examples doesn't carry over stale variable/parameter overrides. */
  loadExample: (id: string) => Promise<void>;
  /** Replaces the entire file set and mock run config with a shared state decoded from a share link. */
  loadSharedState: (shared: SharedRunState) => Promise<void>;
}

/** The inverse of loadSharedState - extracts exactly the fields a share link needs to reproduce the current run, nothing derived/transient. */
export function getShareState(state: PipelineState): SharedRunState {
  return {
    files: state.files,
    entryPath: state.entryPath,
    variables: state.variables,
    parameters: state.parameters,
    outcomeOverrides: state.outcomeOverrides,
    stepOutputs: state.stepOutputs,
    excludedStages: state.excludedStages,
    simulatedBranch: state.simulatedBranch,
    simulatedReason: state.simulatedReason,
    simulatedTargetBranch: state.simulatedTargetBranch,
  };
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
      resolvedParameters: {},
      templateDiagnostics: [],
      dagDiagnostics: [],
      parseError: null,
      runtimeError: null,
      isResolving: false,

      variables: deriveTriggerVariables(DEFAULT_TRIGGER),
      parameters: {},
      outcomeOverrides: {},
      stepOutputs: {},
      excludedStages: [],

      simulatedBranch: DEFAULT_TRIGGER.branch,
      simulatedReason: DEFAULT_TRIGGER.reason,
      simulatedTargetBranch: DEFAULT_TRIGGER.targetBranch,

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

      setTrigger: async (trigger) => {
        set((state) => {
          if (trigger.branch !== undefined) state.simulatedBranch = trigger.branch;
          if (trigger.reason !== undefined) state.simulatedReason = trigger.reason;
          if (trigger.targetBranch !== undefined) state.simulatedTargetBranch = trigger.targetBranch;
          // Clear the full set first, not just overwrite - otherwise switching
          // reason away from PullRequest would leave stale System.PullRequest.*
          // values behind, since the non-PR derivation doesn't produce those keys.
          for (const key of TRIGGER_VARIABLE_KEYS) delete state.variables[key];
          const derived = deriveTriggerVariables({ branch: state.simulatedBranch, reason: state.simulatedReason, targetBranch: state.simulatedTargetBranch });
          Object.assign(state.variables, derived);
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
          state.variables = deriveTriggerVariables(DEFAULT_TRIGGER);
          state.parameters = {};
          state.outcomeOverrides = {};
          state.stepOutputs = {};
          state.excludedStages = [];
          state.simulatedBranch = DEFAULT_TRIGGER.branch;
          state.simulatedReason = DEFAULT_TRIGGER.reason;
          state.simulatedTargetBranch = DEFAULT_TRIGGER.targetBranch;
        });
        await resolveAndRecompute();
      },

      loadExample: async (id) => {
        const example = EXAMPLE_PIPELINES.find((e) => e.id === id);
        if (!example) return;
        set((state) => {
          state.files = { [ENTRY_FILE_NAME]: example.yaml };
          state.entryPath = ENTRY_FILE_NAME;
          state.activeFilePath = ENTRY_FILE_NAME;
          state.hasImportedFiles = true;
          state.variables = deriveTriggerVariables(DEFAULT_TRIGGER);
          state.parameters = {};
          state.outcomeOverrides = {};
          state.stepOutputs = {};
          state.excludedStages = [];
          state.simulatedBranch = DEFAULT_TRIGGER.branch;
          state.simulatedReason = DEFAULT_TRIGGER.reason;
          state.simulatedTargetBranch = DEFAULT_TRIGGER.targetBranch;
        });
        await resolveAndRecompute();
      },

      loadSharedState: async (shared) => {
        set((state) => {
          const files = Object.keys(shared.files).length > 0 ? castDraft(shared.files) : { [ENTRY_FILE_NAME]: DEFAULT_YAML };
          state.files = files as Record<string, string>;
          // A share link's entryPath could in principle point at a file that
          // doesn't exist in its own files map (hand-crafted/corrupted link) -
          // fall back to any available file rather than leaving entryPath
          // dangling, which resolveAndRecompute treats as "no file selected".
          state.entryPath = shared.entryPath in files ? shared.entryPath : Object.keys(files)[0];
          state.activeFilePath = state.entryPath;
          state.hasImportedFiles = true;
          state.variables = castDraft(shared.variables);
          state.parameters = castDraft(shared.parameters);
          state.outcomeOverrides = castDraft(shared.outcomeOverrides);
          state.stepOutputs = castDraft(shared.stepOutputs);
          state.excludedStages = [...shared.excludedStages];
          state.simulatedBranch = shared.simulatedBranch;
          state.simulatedReason = shared.simulatedReason;
          state.simulatedTargetBranch = shared.simulatedTargetBranch;
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
        simulatedBranch: state.simulatedBranch,
        simulatedReason: state.simulatedReason,
        simulatedTargetBranch: state.simulatedTargetBranch,
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
    const { ir, diagnostics, parameterDeclarations, resolvedParameters } = await resolvePipeline(entryPath, vfs, {
      variables,
      parameters,
    });
    usePipelineStore.setState({
      ir: castDraft(ir),
      templateDiagnostics: castDraft(diagnostics),
      parameterDeclarations: castDraft(parameterDeclarations),
      resolvedParameters: castDraft(resolvedParameters),
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
  const { ir, variables, resolvedParameters, outcomeOverrides, stepOutputs, excludedStages } = usePipelineStore.getState();
  if (!ir) {
    usePipelineStore.setState({ graph: null, report: null, dagDiagnostics: [], runtimeError: null });
    return;
  }
  try {
    const dagDiagnostics: Diagnostic[] = [];
    const graph = buildGraph(ir, dagDiagnostics);
    // Use the fully-resolved parameter set (declared defaults merged with
    // overrides), not the raw override-only `parameters` map - otherwise a
    // condition referencing a parameter the user never touched in the UI
    // would incorrectly throw "unknown parameter" despite it having a default.
    const report = simulateRun(graph, { variables, parameters: resolvedParameters, outcomeOverrides, stepOutputs, excludedStages });
    usePipelineStore.setState({ graph, report, dagDiagnostics, runtimeError: null });
  } catch (err) {
    // A condition expression can throw (e.g. a mock parameter/variable value
    // of the wrong shape) - surface it as a diagnostic instead of crashing
    // the whole app, matching how template-resolution errors are handled.
    usePipelineStore.setState({
      graph: null,
      report: null,
      dagDiagnostics: [],
      runtimeError: err instanceof Error ? err.message : String(err),
    });
  }
}
