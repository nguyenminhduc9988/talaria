/** Map a file path to a coarse language/kind used by detector `applies` gates. */

const EXT_KIND: Record<string, string> = {
  ".html": "html",
  ".htm": "html",
  ".md": "markdown",
  ".markdown": "markdown",
  ".py": "python",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".json": "json",
  ".css": "css",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".xml": "xml",
  ".txt": "text",
};

export function fileKind(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "text";
  return EXT_KIND[path.slice(dot).toLowerCase()] ?? "text";
}
