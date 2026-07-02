"use client";

import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

const extensions = [yaml(), keymap.of([indentWithTab])];

export function YamlEditor({ value, onChange }: { readonly value: string; readonly onChange: (value: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--pc-border)" }}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        height="18rem"
        theme="light"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          tabSize: 2,
        }}
        style={{ fontSize: 12 }}
      />
    </div>
  );
}
