"use client";

import { Document16Regular, Star16Filled, Star16Regular, Dismiss16Regular } from "@fluentui/react-icons";

export function FileTreeViewer({
  files,
  entryPath,
  activeFilePath,
  onSelect,
  onSetEntry,
  onRemove,
}: {
  readonly files: Readonly<Record<string, string>>;
  readonly entryPath: string;
  readonly activeFilePath: string;
  readonly onSelect: (path: string) => void;
  readonly onSetEntry: (path: string) => void;
  readonly onRemove: (path: string) => void;
}) {
  const paths = Object.keys(files).sort();

  return (
    <ul className="flex flex-col gap-0.5">
      {paths.map((path) => {
        const depth = path.split("/").length - 1;
        const basename = path.split("/").at(-1);
        const isEntry = path === entryPath;
        const isActive = path === activeFilePath;

        return (
          <li key={path} style={{ paddingLeft: depth * 14 }}>
            <div
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs"
              style={{ background: isActive ? "var(--pc-inprogress-bg)" : "transparent" }}
            >
              <button type="button" onClick={() => onSetEntry(path)} title={isEntry ? "Entry pipeline file" : "Set as entry pipeline file"}>
                {isEntry ? <Star16Filled style={{ color: "var(--pc-accent)" }} /> : <Star16Regular style={{ color: "var(--pc-text-secondary)" }} />}
              </button>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-1 truncate text-left" onClick={() => onSelect(path)}>
                <Document16Regular style={{ color: "var(--pc-text-secondary)" }} />
                <span className="truncate" style={{ color: "var(--pc-text)" }} title={path}>
                  {basename}
                </span>
              </button>
              {paths.length > 1 && (
                <button type="button" onClick={() => onRemove(path)} title="Remove file" style={{ color: "var(--pc-text-secondary)" }}>
                  <Dismiss16Regular />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
