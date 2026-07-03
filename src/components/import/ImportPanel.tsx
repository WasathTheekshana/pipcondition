"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone, type FileWithPath } from "react-dropzone";
import { ArrowUpload16Regular } from "@fluentui/react-icons";
import { usePipelineStore } from "@/store/pipeline.store";
import type { Diagnostic } from "@/lib/template";
import { YamlEditor, type EditorDiagnostic } from "./YamlEditor";
import { FileTreeViewer } from "./FileTreeViewer";
import { ExamplesPanel } from "./ExamplesPanel";

/** Identical warnings (e.g. the same unresolvable cross-repo template referenced by several stages) collapse to one entry. */
function dedupeByMessage(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return Array.from(new Map(diagnostics.map((d) => [d.message, d])).values());
}

function pathOf(file: FileWithPath): string {
  return (file.path ?? file.name).replace(/^\.?\//, "");
}

export function ImportPanel() {
  const files = usePipelineStore((s) => s.files);
  const entryPath = usePipelineStore((s) => s.entryPath);
  const activeFilePath = usePipelineStore((s) => s.activeFilePath);
  const setFileContent = usePipelineStore((s) => s.setFileContent);
  const addFiles = usePipelineStore((s) => s.addFiles);
  const removeFile = usePipelineStore((s) => s.removeFile);
  const setEntryPath = usePipelineStore((s) => s.setEntryPath);
  const setActiveFilePath = usePipelineStore((s) => s.setActiveFilePath);

  const parseError = usePipelineStore((s) => s.parseError);
  const runtimeError = usePipelineStore((s) => s.runtimeError);
  const templateDiagnostics = usePipelineStore((s) => s.templateDiagnostics);
  const dagDiagnostics = usePipelineStore((s) => s.dagDiagnostics);
  const isResolving = usePipelineStore((s) => s.isResolving);
  const [warningsHidden, setWarningsHidden] = useState(false);

  const errors = [...templateDiagnostics, ...dagDiagnostics].filter((d) => d.severity === "error");
  const warnings = useMemo(() => dedupeByMessage([...templateDiagnostics, ...dagDiagnostics].filter((d) => d.severity === "warning")), [templateDiagnostics, dagDiagnostics]);

  const onDrop = useCallback(
    (accepted: FileWithPath[]) => {
      void (async () => {
        const entries = await Promise.all(accepted.map(async (file) => [pathOf(file), await file.text()] as const));
        await addFiles(Object.fromEntries(entries));
      })();
    },
    [addFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "text/yaml": [".yml", ".yaml"] } });

  const activeContent = files[activeFilePath] ?? "";

  // Only diagnostics we can pin to an exact source line (currently raw YAML
  // parse errors) get a live inline underline in the editor - everything
  // else still shows in the list below with a "jump to file" link.
  const editorDiagnostics = useMemo<EditorDiagnostic[]>(
    () =>
      [...templateDiagnostics, ...dagDiagnostics]
        .filter((d): d is Diagnostic & { line: number } => d.path === activeFilePath && d.line !== undefined)
        .map((d) => ({ line: d.line, message: d.message, severity: d.severity })),
    [templateDiagnostics, dagDiagnostics, activeFilePath],
  );

  return (
    <div className="flex flex-col gap-2 p-4">
      <ExamplesPanel />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
          Pipeline files
        </span>
        {isResolving && (
          <span className="text-xs" style={{ color: "var(--pc-text-secondary)" }}>
            Resolving&hellip;
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex w-56 shrink-0 flex-col gap-2">
          <div
            {...getRootProps()}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-2 py-3 text-center text-xs"
            style={{
              borderColor: isDragActive ? "var(--pc-accent)" : "var(--pc-border)",
              background: isDragActive ? "var(--pc-inprogress-bg)" : "var(--pc-canvas-bg)",
              color: "var(--pc-text-secondary)",
            }}
          >
            <input {...getInputProps()} />
            <ArrowUpload16Regular />
            <span>Drop .yml/.yaml files or folders here, or click to browse</span>
          </div>
          <FileTreeViewer files={files} entryPath={entryPath} activeFilePath={activeFilePath} onSelect={setActiveFilePath} onSetEntry={(p) => void setEntryPath(p)} onRemove={(p) => void removeFile(p)} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="text-xs" style={{ color: "var(--pc-text-secondary)" }}>
            Editing: <span className="font-mono">{activeFilePath}</span>
            {activeFilePath === entryPath && (
              <span className="ml-2 rounded-full px-2 py-0.5" style={{ background: "var(--pc-inprogress-bg)", color: "var(--pc-accent)" }}>
                entry
              </span>
            )}
          </div>
          <YamlEditor value={activeContent} onChange={(text) => void setFileContent(activeFilePath, text)} diagnostics={editorDiagnostics} />
        </div>
      </div>

      {parseError && (
        <div className="rounded border px-2 py-1.5 text-xs" style={{ borderColor: "var(--pc-failed)", background: "var(--pc-failed-bg)", color: "var(--pc-failed)" }}>
          {parseError}
        </div>
      )}
      {runtimeError && (
        <div className="rounded border px-2 py-1.5 text-xs" style={{ borderColor: "var(--pc-failed)", background: "var(--pc-failed-bg)", color: "var(--pc-failed)" }}>
          Simulation failed: {runtimeError}
        </div>
      )}
      {errors.map((d, i) => (
        <DiagnosticRow key={`e${i}`} message={d.message} path={d.path} tone="error" files={files} onJump={setActiveFilePath} />
      ))}
      {warnings.length > 0 && (
        <button
          type="button"
          onClick={() => setWarningsHidden((v) => !v)}
          className="self-start text-xs underline"
          style={{ color: "var(--pc-text-secondary)" }}
        >
          {warningsHidden ? `Show ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : `Hide ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
        </button>
      )}
      {!warningsHidden &&
        warnings.map((d, i) => <DiagnosticRow key={`w${i}`} message={d.message} path={d.path} tone="warning" files={files} onJump={setActiveFilePath} />)}
    </div>
  );
}

function DiagnosticRow({
  message,
  path,
  tone,
  files,
  onJump,
}: {
  readonly message: string;
  readonly path: string;
  readonly tone: "error" | "warning";
  readonly files: Readonly<Record<string, string>>;
  readonly onJump: (path: string) => void;
}) {
  const isJumpable = path in files;
  const color = tone === "error" ? "var(--pc-failed)" : "var(--pc-text)";
  const borderColor = tone === "error" ? "var(--pc-failed)" : "var(--pc-warning)";
  const background = tone === "error" ? "var(--pc-failed-bg)" : "var(--pc-warning-bg)";

  return (
    <div className="rounded border px-2 py-1.5 text-xs" style={{ borderColor, background, color }}>
      {isJumpable ? (
        <button type="button" className="font-mono underline" onClick={() => onJump(path)}>
          {path}
        </button>
      ) : (
        <span className="font-mono">{path}</span>
      )}
      : {message}
    </div>
  );
}
