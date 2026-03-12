import { NextRequest, NextResponse } from "next/server";
import { shouldIncludeFile, langFromPath, MAX_FILES, MAX_FILE_SIZE } from "@/lib/import-utils";

export const maxDuration = 30;

const VERCEL_API = "https://api.vercel.com";

// ── URL parser ──────────────────────────────────────────────────────────────

interface ParsedVercelUrl {
  type: "project" | "deployment";
  team?: string;
  projectName?: string;
  deploymentId?: string;
  deploymentHost?: string;
}

const NON_PROJECT_SLUGS = new Set([
  "docs", "blog", "guides", "support", "pricing", "settings",
  "account", "integrations", "marketplace", "templates", "signup",
  "login", "new", "import", "dashboard",
]);

function parseVercelUrl(url: string): ParsedVercelUrl | null {
  const cleaned = url.trim().replace(/\/+$/, "");

  // Pattern 1: vercel.com/team/project[/deploymentId]
  const dashMatch = cleaned.match(
    /(?:https?:\/\/)?(?:www\.)?vercel\.com\/([^/?#]+)\/([^/?#]+)(?:\/([^/?#]+))?/
  );
  if (dashMatch) {
    const [, team, project, dplId] = dashMatch;
    if (NON_PROJECT_SLUGS.has(team.toLowerCase())) return null;
    if (dplId) {
      return { type: "deployment", team, projectName: project, deploymentId: dplId };
    }
    return { type: "project", team, projectName: project };
  }

  // Pattern 2: *.vercel.app (deployment or production URL)
  const appMatch = cleaned.match(
    /(?:https?:\/\/)?([a-z0-9][a-z0-9-]*(?:-[a-z0-9]+)*)\.vercel\.app/i
  );
  if (appMatch) {
    return { type: "deployment", deploymentHost: appMatch[1] + ".vercel.app" };
  }

  // Pattern 3: Bare project name (no slashes, no dots, alphanumeric + hyphens)
  if (/^[a-z0-9][a-z0-9-]*$/i.test(cleaned)) {
    return { type: "project", projectName: cleaned };
  }

  return null;
}

// ── File tree flattener ─────────────────────────────────────────────────────

interface VercelFileEntry {
  name: string;
  type: "directory" | "file" | "symlink" | "lambda" | "middleware" | "invalid";
  uid?: string;
  children?: VercelFileEntry[];
  contentType?: string;
  mode: number;
}

interface FlatFile {
  path: string;
  uid: string;
}

function flattenFileTree(entries: VercelFileEntry[], prefix = ""): FlatFile[] {
  const result: FlatFile[] = [];
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === "file" && entry.uid) {
      result.push({ path: fullPath, uid: entry.uid });
    } else if (entry.type === "directory" && entry.children) {
      result.push(...flattenFileTree(entry.children, fullPath));
    }
  }
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function vercelHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function teamQuery(teamId?: string): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

function appendTeam(base: string, teamId?: string): string {
  const sep = base.includes("?") ? "&" : "?";
  return teamId ? `${base}${sep}teamId=${encodeURIComponent(teamId)}` : base;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, token, teamId } = await req.json();

    if (!url?.trim()) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }
    if (!token?.trim()) {
      return NextResponse.json(
        { error: "Vercel API token required. Create one at vercel.com/account/tokens" },
        { status: 400 }
      );
    }

    const parsed = parseVercelUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid Vercel URL. Use: vercel.com/team/project, project.vercel.app, or a project name" },
        { status: 400 }
      );
    }

    const headers = vercelHeaders(token);
    const qs = teamQuery(teamId);

    // ── Step 1: Resolve to a deployment ID ──────────────────────────────

    let deploymentId: string;
    let projectName: string;
    let linkedGitRepo: string | null = null;

    if (parsed.type === "deployment" && (parsed.deploymentId || parsed.deploymentHost)) {
      // Direct deployment reference
      deploymentId = parsed.deploymentHost || parsed.deploymentId!;
      projectName = parsed.projectName || deploymentId;

      // Verify the deployment exists
      const dplResp = await fetch(
        appendTeam(`${VERCEL_API}/v13/deployments/${encodeURIComponent(deploymentId)}`, teamId),
        { headers }
      );
      if (dplResp.status === 401) {
        return NextResponse.json({ error: "Invalid Vercel token. Check your API token and try again." }, { status: 401 });
      }
      if (dplResp.status === 403) {
        return NextResponse.json({ error: "Access denied. Your token may not have access to this team/project." }, { status: 403 });
      }
      if (!dplResp.ok) {
        return NextResponse.json({ error: `Deployment not found: ${deploymentId}` }, { status: 404 });
      }
      const dplData = await dplResp.json();
      deploymentId = dplData.id || dplData.uid || deploymentId;
      projectName = dplData.name || projectName;

      // Extract linked Git repo if available
      if (dplData.meta?.githubOrg && dplData.meta?.githubRepo) {
        linkedGitRepo = `${dplData.meta.githubOrg}/${dplData.meta.githubRepo}`;
      }
    } else {
      // Project name → look up project → find latest deployment
      const projResp = await fetch(
        `${VERCEL_API}/v9/projects/${encodeURIComponent(parsed.projectName!)}${qs}`,
        { headers }
      );

      if (projResp.status === 401) {
        return NextResponse.json({ error: "Invalid Vercel token. Check your API token and try again." }, { status: 401 });
      }
      if (projResp.status === 403) {
        return NextResponse.json({
          error: "Access denied. If this is a team project, you may need to provide a Team ID. " +
            "Find it in your Vercel dashboard URL: vercel.com/team_slug/..."
        }, { status: 403 });
      }
      if (!projResp.ok) {
        return NextResponse.json({ error: `Project "${parsed.projectName}" not found on Vercel.` }, { status: 404 });
      }

      const projData = await projResp.json();
      projectName = projData.name || parsed.projectName!;

      // Extract linked Git repo from project
      if (projData.link?.type === "github" && projData.link?.org && projData.link?.repo) {
        linkedGitRepo = `${projData.link.org}/${projData.link.repo}`;
      }

      // Get latest READY production deployment
      const dplUrl = appendTeam(
        `${VERCEL_API}/v6/deployments?projectId=${encodeURIComponent(projData.id)}&state=READY&target=production&limit=1`,
        teamId
      );
      const dplResp = await fetch(dplUrl, { headers });
      if (!dplResp.ok) {
        return NextResponse.json({ error: "Failed to fetch deployments for this project." }, { status: 500 });
      }
      const dplData = await dplResp.json();
      if (!dplData.deployments?.length) {
        // No deployments found — fall back to GitHub if linked
        if (linkedGitRepo) {
          return NextResponse.json({
            fallbackGitHub: `https://github.com/${linkedGitRepo}`,
            reason: "No ready deployments found, but this project is linked to GitHub.",
          });
        }
        return NextResponse.json({ error: "No ready deployments found for this project." }, { status: 404 });
      }
      deploymentId = dplData.deployments[0].uid;
    }

    // ── Step 2: Get file tree ───────────────────────────────────────────

    const treeResp = await fetch(
      appendTeam(`${VERCEL_API}/v6/deployments/${encodeURIComponent(deploymentId)}/files`, teamId),
      { headers }
    );

    if (!treeResp.ok || treeResp.status === 404) {
      // File tree not available — likely a Git-based deployment
      if (linkedGitRepo) {
        return NextResponse.json({
          fallbackGitHub: `https://github.com/${linkedGitRepo}`,
          reason: "This deployment was created from Git. Source files are available through the linked GitHub repo.",
        });
      }
      return NextResponse.json({
        error: "Cannot retrieve source files. This deployment may have been created from Git. " +
          "Try importing from GitHub instead, or deploy using the Vercel CLI to enable source file access."
      }, { status: 400 });
    }

    const tree: VercelFileEntry[] = await treeResp.json();
    if (!Array.isArray(tree) || tree.length === 0) {
      if (linkedGitRepo) {
        return NextResponse.json({
          fallbackGitHub: `https://github.com/${linkedGitRepo}`,
          reason: "Deployment has no retrievable source files, but is linked to GitHub.",
        });
      }
      return NextResponse.json({ error: "No files found in this deployment." }, { status: 400 });
    }

    // ── Step 3: Flatten and filter ──────────────────────────────────────

    const allFiles = flattenFileTree(tree);
    const codeFiles = allFiles
      .filter(f => shouldIncludeFile(f.path))
      .slice(0, MAX_FILES);

    if (codeFiles.length === 0) {
      return NextResponse.json({ error: "No supported code files found in this deployment." }, { status: 400 });
    }

    // ── Step 4: Fetch file contents in batches of 10 ────────────────────

    const files: Array<{ path: string; content: string; size: number; language: string }> = [];

    for (let i = 0; i < codeFiles.length; i += 10) {
      const batch = codeFiles.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (f) => {
          const resp = await fetch(
            appendTeam(
              `${VERCEL_API}/v6/deployments/${encodeURIComponent(deploymentId)}/files/${encodeURIComponent(f.uid)}`,
              teamId
            ),
            { headers }
          );
          if (!resp.ok) return null;

          // Response is the file content — could be base64 JSON or raw text
          const text = await resp.text();
          let content: string;
          try {
            const parsed = JSON.parse(text);
            if (typeof parsed === "string") {
              // Direct base64 string
              content = Buffer.from(parsed, "base64").toString("utf-8");
            } else if (parsed?.data) {
              content = Buffer.from(parsed.data, "base64").toString("utf-8");
            } else {
              // Already decoded or unknown shape — use as-is
              content = text;
            }
          } catch {
            // Not JSON — treat as raw text
            content = text;
          }

          // Skip binary files
          if (content.includes("\0")) return null;
          // Skip oversized
          if (content.length > MAX_FILE_SIZE) return null;

          return {
            path: f.path,
            content,
            size: content.length,
            language: langFromPath(f.path),
          };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          files.push(r.value);
        }
      }
    }

    return NextResponse.json({
      files,
      project: projectName,
      deployment: deploymentId,
      totalFound: allFiles.length,
      imported: files.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitize — don't leak the Vercel token in errors
    const safeMsg = msg.replace(/Bearer\s+[^\s"]+/gi, "Bearer [REDACTED]");
    return NextResponse.json({ error: safeMsg }, { status: 500 });
  }
}
