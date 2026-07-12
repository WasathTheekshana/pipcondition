"use client";

import { useEffect, useMemo } from "react";
import { ImportPanel } from "@/components/import/ImportPanel";
import { RunHeader } from "@/components/run-view/RunHeader";
import { StageGraphCanvas } from "@/components/run-view/StageGraph/StageGraphCanvas";
import { JobGraphCanvas } from "@/components/run-view/StageGraph/JobGraphCanvas";
import { JobCard } from "@/components/run-view/JobList/JobCard";
import { LogDrawer } from "@/components/run-view/LogPanel/LogDrawer";
import { SkipSummary } from "@/components/run-view/SkipSummary";
import { buildViewModel } from "@/components/run-view/view-model";
import { RunParametersPanel } from "@/components/mock-config/RunParametersPanel";
import { TriggerSimulatorPanel } from "@/components/mock-config/TriggerSimulatorPanel";
import { StageSelector } from "@/components/mock-config/StageSelector";
import { usePipelineStore } from "@/store/pipeline.store";
import { useUiStore } from "@/store/ui.store";
import { readShareStateFromLocation, clearShareHash } from "@/lib/share-link";

export default function Home() {
  const initialize = usePipelineStore((s) => s.initialize);
  const loadSharedState = usePipelineStore((s) => s.loadSharedState);
  const graph = usePipelineStore((s) => s.graph);
  const report = usePipelineStore((s) => s.report);

  const selectedStageId = useUiStore((s) => s.selectedStageId);
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const selectedNodeKind = useUiStore((s) => s.selectedNodeKind);
  const selectStage = useUiStore((s) => s.selectStage);
  const selectNode = useUiStore((s) => s.selectNode);

  useEffect(() => {
    // A share link's payload lives in the URL hash - if present, it takes
    // priority over whatever's in localStorage. Loaded once and then the
    // hash is stripped, so a reload (or further edits) doesn't keep
    // re-hydrating over local changes, and continues from local storage as normal after that.
    const shared = readShareStateFromLocation();
    if (shared) {
      clearShareHash();
      void loadSharedState(shared);
    } else {
      void initialize();
    }
  }, [initialize, loadSharedState]);

  const stages = useMemo(() => (graph && report ? buildViewModel(graph, report) : []), [graph, report]);

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      selectStage(stages[0].id);
    }
  }, [stages, selectedStageId, selectStage]);

  const activeStage = stages.find((s) => s.id === selectedStageId) ?? stages[0] ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-auto">
          <ImportPanel />
          <TriggerSimulatorPanel />
          <RunParametersPanel />
          <StageSelector stages={stages} />

          {stages.length > 0 && (
            <>
              <RunHeader stageResults={stages.map((s) => s.report.result)} />
              <SkipSummary stages={stages} />
              <StageGraphCanvas stages={stages} selectedStageId={selectedStageId} onSelectStage={selectStage} />
              {activeStage && (
                <div className="flex flex-col gap-2 p-4">
                  <div className="text-sm font-semibold" style={{ color: "var(--pc-text)" }}>
                    {activeStage.name} &mdash; jobs
                  </div>
                  <JobGraphCanvas stageId={activeStage.id} jobs={activeStage.jobs} selectedNodeId={selectedNodeId} onSelectJob={(id) => selectNode(id, "job")} />
                  {activeStage.jobs.map((job) => (
                    <JobCard key={job.id} job={job} selectedNodeId={selectedNodeId} onSelectNode={(id, kind) => selectNode(id, kind)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="w-96 shrink-0 border-l" style={{ borderColor: "var(--pc-border)", background: "var(--pc-card-bg)" }}>
          <LogDrawer stages={stages} selectedNodeId={selectedNodeId} selectedNodeKind={selectedNodeKind} />
        </aside>
      </div>
    </div>
  );
}
