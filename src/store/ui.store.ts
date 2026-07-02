import { create } from "zustand";

interface UiState {
  readonly selectedStageId: string | null;
  readonly selectedNodeId: string | null;
  readonly selectedNodeKind: "stage" | "job" | "step" | null;
  readonly importPanelOpen: boolean;
  selectStage: (stageId: string | null) => void;
  selectNode: (nodeId: string | null, kind: "stage" | "job" | "step" | null) => void;
  toggleImportPanel: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedStageId: null,
  selectedNodeId: null,
  selectedNodeKind: null,
  importPanelOpen: true,
  selectStage: (stageId) => set({ selectedStageId: stageId }),
  selectNode: (nodeId, kind) => set({ selectedNodeId: nodeId, selectedNodeKind: kind }),
  toggleImportPanel: () => set((s) => ({ importPanelOpen: !s.importPanelOpen })),
}));
