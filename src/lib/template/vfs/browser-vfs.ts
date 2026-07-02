import type { VirtualFileSystem } from "./types";
import { VfsFileNotFoundError } from "./types";

function normalizeKey(path: string): string {
  return path.replace(/^\.\//, "").replace(/\\/g, "/");
}

/** In-memory VFS backed by a path->content map, populated from drag-drop/paste in the UI. */
export function createBrowserVfs(files: Record<string, string>): VirtualFileSystem {
  const normalized = new Map(Object.entries(files).map(([path, content]) => [normalizeKey(path), content]));

  return {
    async readFile(path: string): Promise<string> {
      const key = normalizeKey(path);
      const content = normalized.get(key);
      if (content === undefined) throw new VfsFileNotFoundError(path);
      return content;
    },
    async exists(path: string): Promise<boolean> {
      return normalized.has(normalizeKey(path));
    },
    async list(): Promise<readonly string[]> {
      return Array.from(normalized.keys());
    },
  };
}
