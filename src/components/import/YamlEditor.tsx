"use client";

import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { linter, lintGutter, type Diagnostic as LintDiagnostic } from "@codemirror/lint";
import { ZoomIn16Regular, ZoomOut16Regular, ArrowMinimize16Regular, ArrowMaximize16Regular } from "@fluentui/react-icons";

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 22;
const COMPACT_HEIGHT = "18rem";
const FOCUSED_HEIGHT = "70vh";

export interface EditorDiagnostic {
  /** 1-based line number within this file's own content. */
  readonly line: number;
  readonly message: string;
  readonly severity: "error" | "warning";
}

/** Live, editor-native error/warning underlines - like a compiler's inline squiggles - for diagnostics this simulator can pin to an exact source line (currently raw YAML parse errors; see Diagnostic.line). */
function buildLinter(diagnostics: readonly EditorDiagnostic[]) {
  return linter((view) => {
    const results: LintDiagnostic[] = [];
    const doc = view.state.doc;
    for (const d of diagnostics) {
      if (d.line < 1 || d.line > doc.lines) continue;
      const lineInfo = doc.line(d.line);
      results.push({ from: lineInfo.from, to: lineInfo.to, severity: d.severity, message: d.message });
    }
    return results;
  });
}

export function YamlEditor({
  value,
  onChange,
  diagnostics = [],
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly diagnostics?: readonly EditorDiagnostic[];
}) {
  const [fontSize, setFontSize] = useState(12);
  const [focused, setFocused] = useState(false);

  const extensions = useMemo(() => [yaml(), keymap.of([indentWithTab]), lintGutter(), buildLinter(diagnostics)], [diagnostics]);

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--pc-border)" }}>
      <div className="flex items-center justify-end gap-1 border-b px-2 py-1" style={{ borderColor: "var(--pc-border)", background: "var(--pc-canvas-bg)" }}>
        <EditorToolbarButton label="Zoom out" onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 1))}>
          <ZoomOut16Regular />
        </EditorToolbarButton>
        <span className="w-8 text-center text-xs" style={{ color: "var(--pc-text-secondary)" }}>
          {fontSize}px
        </span>
        <EditorToolbarButton label="Zoom in" onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 1))}>
          <ZoomIn16Regular />
        </EditorToolbarButton>
        <EditorToolbarButton label={focused ? "Collapse editor" : "Expand editor"} onClick={() => setFocused((f) => !f)}>
          {focused ? <ArrowMinimize16Regular /> : <ArrowMaximize16Regular />}
        </EditorToolbarButton>
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        height={focused ? FOCUSED_HEIGHT : COMPACT_HEIGHT}
        theme="light"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          tabSize: 2,
        }}
        style={{ fontSize }}
      />
    </div>
  );
}

function EditorToolbarButton({ label, onClick, children }: { readonly label: string; readonly onClick: () => void; readonly children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center rounded p-1 hover:opacity-70"
      style={{ color: "var(--pc-text-secondary)" }}
    >
      {children}
    </button>
  );
}
