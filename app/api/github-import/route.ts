import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// File extensions we want to fetch (code files only)
const CODE_EXTENSIONS = new Set([
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

// Directories/patterns to skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  "__pycache__", ".venv", "venv", "vendor", ".cache",
  "coverage", ".nyc_output", ".turbo",
]);

const MAX_FILES = 50;
const MAX_FILE_SIZE = 100000; // 100KB per file

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

function parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string; path?: string } | null {
  // Handle various GitHub URL formats
  const cleaned = url.trim().replace(/\/+$/, "").replace(/\.git$/, "");

  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch
  // https://github.com/owner/repo/tree/branch/path
  const match = cleaned.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/
  );

  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] || undefined,
    path: match[4] || undefined,
  };
}

function shouldIncludeFile(path: string, size?: number): boolean {
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

function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    css: "css", html: "html", json: "json", md: "markdown", sh: "bash",
    vue: "vue", svelte: "svelte", php: "php", swift: "swift", kt: "kotlin",
  };
  return map[ext] || "text";
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url?.trim()) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Use format: https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    const { owner, repo, branch } = parsed;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CodeAgent/1.0",
    };

    // Step 1: Get the default branch if not specified
    let targetBranch = branch;
    if (!targetBranch) {
      const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (repoResp.status === 404) {
        return NextResponse.json(
          { error: `Repository ${owner}/${repo} not found. Make sure it's a public repo.` },
          { status: 404 }
        );
      }
      if (!repoResp.ok) {
        return NextResponse.json(
          { error: `GitHub API error: ${repoResp.status}` },
          { status: repoResp.status }
        );
      }
      const repoData = await repoResp.json();
      targetBranch = repoData.default_branch || "main";
    }

    // Step 2: Get the full file tree recursively (single API call)
    const treeResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
      { headers }
    );

    if (!treeResp.ok) {
      const errText = await treeResp.text();
      return NextResponse.json(
        { error: `Could not fetch repo tree: ${treeResp.status}. ${errText.slice(0, 200)}` },
        { status: treeResp.status }
      );
    }

    const treeData = await treeResp.json();
    const allItems: GitHubTreeItem[] = treeData.tree || [];

    // Step 3: Filter to only code files
    const codeFiles = allItems
      .filter((item) => item.type === "blob" && shouldIncludeFile(item.path, item.size))
      .slice(0, MAX_FILES);

    if (codeFiles.length === 0) {
      return NextResponse.json(
        { error: "No supported code files found in this repository." },
        { status: 400 }
      );
    }

    // Step 4: Fetch file contents in parallel (batch of 10)
    const files: Array<{ path: string; content: string; size: number; language: string }> = [];

    for (let i = 0; i < codeFiles.length; i += 10) {
      const batch = codeFiles.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const resp = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${targetBranch}`,
            { headers }
          );
          if (!resp.ok) return null;
          const data = await resp.json();
          if (data.encoding !== "base64" || !data.content) return null;

          const content = Buffer.from(data.content, "base64").toString("utf-8");

          // Skip binary-looking files
          if (content.includes("\0")) return null;

          return {
            path: item.path,
            content,
            size: content.length,
            language: langFromPath(item.path),
          };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          files.push(result.value);
        }
      }
    }

    return NextResponse.json({
      files,
      repo: `${owner}/${repo}`,
      branch: targetBranch,
      totalFound: allItems.filter((i) => i.type === "blob").length,
      imported: files.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
