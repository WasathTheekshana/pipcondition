/**
 * Source-agnostic file access for the template resolver: implemented once
 * against a browser drag-drop file map (browser-vfs.ts) and once against the
 * Azure DevOps REST API proxy (ado-vfs.ts, added in Phase 6).
 */
export interface VirtualFileSystem {
  /** Reads a file's raw text content. Throws if the path doesn't exist. */
  readFile(path: string): Promise<string>;
  /** Returns true if the given path exists in this filesystem. */
  exists(path: string): Promise<boolean>;
  /** Lists all known file paths (used by the FileTreeViewer). */
  list(): Promise<readonly string[]>;
}

export class VfsFileNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`File not found: ${path}`);
    this.name = "VfsFileNotFoundError";
  }
}
