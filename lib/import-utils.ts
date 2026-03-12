// ── Shared import utilities ─────────────────────────────────────────────────
// Used by both /api/github-import and /api/vercel-import

export const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift",
  "css", "scss", "less", "html", "vue", "svelte",
  "json", "yaml", "yml", "toml", "xml",
  "sh", "bash", "zsh", "fish",
  "md", "mdx", "txt",
  "c", "cpp", "h", "hpp", "cs",
  "php", "lua", "r", "sql",
  "dockerfile", "makefile", "gitignore",
]);

export const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  "__pycache__", ".venv", "venv", "vendor", ".cache",
  "coverage", ".nyc_output", ".turbo",
]);

export const MAX_FILES = 50;
export const MAX_FILE_SIZE = 100000; // 100KB per file

export function shouldIncludeFile(path: string, size?: number): boolean {
  // Skip large files
  if (size && size > MAX_FILE_SIZE) return false;

  // Skip hidden files (except common config files)
  const filename = path.split("/").pop() || "";
  if (filename.startsWith(".") && !["gitignore", "env.example", "eslintrc.js", "prettierrc"].some(f => filename.includes(f))) {
    return false;
  }

  // Skip excluded directories
  const parts = path.split("/");
  for (const part of parts) {
    if (SKIP_DIRS.has(part.toLowerCase())) return false;
  }

  // Check extension
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const nameLC = filename.toLowerCase();

  // Include extensionless known files
  if (["dockerfile", "makefile", "rakefile", "gemfile", "procfile"].includes(nameLC)) {
    return true;
  }

  return CODE_EXTENSIONS.has(ext);
}

export function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    css: "css", html: "html", json: "json", md: "markdown", sh: "bash",
    vue: "vue", svelte: "svelte", php: "php", swift: "swift", kt: "kotlin",
  };
  return map[ext] || "text";
}
