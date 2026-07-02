/** Joins a template reference against the directory of the file that referenced it, POSIX-style. */
export function resolveTemplatePath(fromFile: string, ref: string): string {
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const parts = [...dir.split("/").filter(Boolean), ...ref.split("/").filter(Boolean)];

  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

/** Splits `template.yml@repoAlias` into its file path and optional repository alias. */
export function splitTemplateRef(ref: string): { readonly path: string; readonly repoAlias?: string } {
  const at = ref.lastIndexOf("@");
  if (at === -1) return { path: ref };
  return { path: ref.slice(0, at), repoAlias: ref.slice(at + 1) };
}
