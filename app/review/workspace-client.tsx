"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Zap, Files, Bot, Clock, Settings, Play, Square, Download, Monitor, RefreshCw, Wifi, WifiOff,
  ChevronRight, Check, X, AlertTriangle, Info, AlertCircle,
  Upload, Eye, Code, GitBranch, Link, Sparkles, Search, Rocket,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { runAgent } from "@/lib/agent";
import type { Finding, AgentMode } from "@/lib/store";

// ── helpers ──────────────────────────────────────────────────────────────────
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

function fileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "🔷", tsx: "⚛️", js: "📜", jsx: "⚛️", py: "🐍", rb: "💎",
    go: "🐹", rs: "🦀", java: "☕", css: "🎨", html: "🌐", json: "📋",
    md: "📝", sh: "💻", vue: "💚", svelte: "🧡", php: "🐘",
  };
  return map[ext] || "📄";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1048576).toFixed(1)}M`;
}

const SEV_CONFIG = {
  critical: { icon: AlertCircle, color: "text-rose", bg: "bg-rose/10", border: "border-rose/25", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-amber", bg: "bg-amber/10", border: "border-amber/25", label: "Warning" },
  info: { icon: Info, color: "text-azure", bg: "bg-azure/10", border: "border-azure/25", label: "Info" },
};

const OR_MODELS = [
  ["deepseek/deepseek-r1-0528:free", "⭐ DeepSeek R1 [FREE]"],
  ["qwen/qwen3-235b-a22b:free", "⭐ Qwen3 235B [FREE]"],
  ["qwen/qwen3-coder:free", "⭐ Qwen3 Coder [FREE]"],
  ["meta-llama/llama-4-maverick:free", "⭐ Llama 4 Maverick [FREE]"],
  ["meta-llama/llama-3.3-70b-instruct:free", "⭐ Llama 3.3 70B [FREE]"],
  ["deepseek/deepseek-chat-v3-0324:free", "⭐ DeepSeek V3 [FREE]"],
  ["google/gemini-2.0-flash-exp:free", "⭐ Gemini 2.0 Flash [FREE]"],
  ["openrouter/auto", "⭐ Auto (best free) [FREE]"],
  ["anthropic/claude-sonnet-4-5", "Claude Sonnet 4.5 [PAID]"],
  ["openai/gpt-4o", "GPT-4o [PAID]"],
  ["google/gemini-2.5-pro-preview", "Gemini 2.5 Pro [PAID]"],
];
const GEM_MODELS = [
  ["gemini-2.5-pro-preview-06-05", "Gemini 2.5 Pro"],
  ["gemini-2.0-flash", "Gemini 2.0 Flash"],
  ["gemini-1.5-pro", "Gemini 1.5 Pro"],
];
// Local LLM state interface
interface LocalModel {
  id: string;
  object: string;
  owned_by: string;
}

// ── sub-components ────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"before" | "after" | "diff">("before");
  const approveFinding = useStore((s) => s.approveFinding);
  const rejectFinding = useStore((s) => s.rejectFinding);
  const sev = SEV_CONFIG[finding.severity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border overflow-hidden transition-all ${
        finding.status === "approved"
          ? "border-emerald/25 bg-emerald/4 opacity-70"
          : finding.status === "rejected"
          ? "border-border bg-card/30 opacity-50"
          : "border-border bg-card hover:border-border/80"
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
        finding.status === "approved" ? "bg-emerald" :
        finding.status === "rejected" ? "bg-muted" :
        finding.severity === "critical" ? "bg-rose" :
        finding.severity === "warning" ? "bg-amber" : "bg-azure"
      }`} />

      <div className="pl-3">
        {/* Header */}
        <button
          className="w-full text-left p-3.5 flex items-start gap-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${sev.bg} ${sev.border} border`}>
            <sev.icon className={`w-3 h-3 ${sev.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${sev.bg} ${sev.color} ${sev.border} border`}>
                {sev.label}
              </span>
              <span className="text-xs text-dim bg-muted/40 px-1.5 py-0.5 rounded-md">{finding.category}</span>
              {finding.line_start && (
                <span className="text-xs text-dim font-mono">L{finding.line_start}</span>
              )}
              <span className="ml-auto text-xs text-dim">Pass {finding.pass}</span>
            </div>
            <div className="font-display font-600 text-sm text-text leading-snug">{finding.title}</div>
          </div>

          <ChevronRight className={`w-4 h-4 text-dim flex-shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        {/* Expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5 space-y-3">
                <p className="text-xs text-ghost leading-relaxed">{finding.explanation}</p>

                {finding.impact && (
                  <p className="text-xs text-emerald">↑ {finding.impact}</p>
                )}

                {(finding.old_code || finding.new_code) && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="flex bg-card/80 border-b border-border">
                      {(["before", "after"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={`px-3 py-1.5 text-xs font-mono capitalize transition-colors ${
                            tab === t ? "text-text border-b border-azure" : "text-dim hover:text-ghost"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <pre className={`text-xs font-mono p-3 overflow-x-auto max-h-48 leading-relaxed ${
                      tab === "before" ? "text-rose/80 bg-rose/3" : "text-emerald/80 bg-emerald/3"
                    }`}>
                      <code>{tab === "before" ? (finding.old_code || "(none)") : (finding.new_code || "")}</code>
                    </pre>
                  </div>
                )}

                {/* Actions */}
                {finding.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveFinding(finding.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald/10 border border-emerald/25 text-emerald hover:bg-emerald/18 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Apply fix
                    </button>
                    <button
                      onClick={() => rejectFinding(finding.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-ghost hover:text-text hover:border-muted transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Skip
                    </button>
                  </div>
                ) : (
                  <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${
                    finding.status === "approved"
                      ? "bg-emerald/10 text-emerald border border-emerald/20"
                      : "bg-muted/30 text-dim border border-border"
                  }`}>
                    {finding.status === "approved" ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {finding.status === "approved" ? "Applied" : "Skipped"}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main workspace ─────────────────────────────────────────────────────────────

export default function WorkspaceClient() {
  const store = useStore();
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [localStatus, setLocalStatus] = useState<"idle" | "scanning" | "connected" | "offline">("idle");
  const [localMessage, setLocalMessage] = useState("");
  const [ghUrl, setGhUrl] = useState("");
  const [ghLoading, setGhLoading] = useState(false);

  // Load API key from session
  useEffect(() => {
    const key = sessionStorage.getItem("ca_api_key");
    const prov = sessionStorage.getItem("ca_provider") as "openrouter" | "gemini" | "local" | null;
    if (prov === "local") {
      store.setConfig({ provider: "local", apiKey: "", model: "" });
    } else if (key) {
      store.setConfig({ apiKey: key, provider: prov || "openrouter" });
    }
  }, []);

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

// Scan for local LLM models
  const scanLocalModels = useCallback(async () => {
    setLocalStatus("scanning");
    setLocalMessage("Scanning for local models...");
    try {
      const resp = await fetch("/api/local-models");
      const data = await resp.json();
      setLocalModels(data.models || []);
      setLocalStatus(data.status === "connected" ? "connected" : "offline");
      setLocalMessage(data.message || "");
      if (data.status === "connected" && data.models.length > 0) {
        store.setConfig({ model: data.models[0].id });
        showToast(`Found ${data.models.length} local model(s)`, "ok");
      }
    } catch {
      setLocalStatus("offline");
      setLocalMessage("Failed to connect. Is LM Studio running?");
    }
  }, [store, showToast]);


  // Auto-scan when switching to local provider
  useEffect(() => {
    if (store.config.provider === "local" && localStatus === "idle") {
      scanLocalModels();
    }
  }, [store.config.provider, localStatus, scanLocalModels]);

  // Import from GitHub URL
  const handleGitHubImport = useCallback(async () => {
    if (!ghUrl.trim()) return;
    setGhLoading(true);
    try {
      const resp = await fetch("/api/github-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ghUrl.trim() }),
      });
      const data = await resp.json();
      if (data.error) {
        showToast(data.error, "err");
        return;
      }
      store.addFiles(data.files);
      store.setProjectName(data.repo.split("/").pop() || "Imported");
      showToast("Imported " + data.imported + "/" + data.totalFound + " files from " + data.repo, "ok");
      setGhUrl("");
      store.setActiveView("files");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "err");
    } finally {
      setGhLoading(false);
    }
  }, [ghUrl, store, showToast]);
  // File drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const readers = acceptedFiles.map(
      (file) =>
        new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            store.addFiles([{
              path: file.name,
              content,
              size: file.size,
              language: langFromPath(file.name),
            }]);
            resolve();
          };
          reader.readAsText(file);
        })
    );
    Promise.all(readers).then(() => {
      showToast(`Uploaded ${acceptedFiles.length} file(s)`, "ok");
      store.setActiveView("files");
    });
  }, [store, showToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      "text/*": [],
      "application/json": [".json"],
      "application/javascript": [".js", ".jsx", ".mjs"],
      "application/typescript": [".ts", ".tsx"],
    },
  });

  const handleRun = async () => {
    try {
      await runAgent(store.selectedMode);
      store.setActiveView("findings");
      showToast("Analysis complete!", "ok");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "err");
    }
  };

  const handleStop = () => {
    store.setAgentRunning(false, null);
    showToast("Agent stopped", "ok");
  };

  const handleDownload = () => {
    const files = Object.entries(store.files);
    if (!files.length) return showToast("No files to download", "err");
    // Simple multi-file download as JSON bundle
    const bundle = Object.fromEntries(files.map(([k, v]) => [k, v.content]));
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${store.projectName.replace(/\s+/g, "-")}-reviewed.json`;
    a.click();
    showToast("Downloaded!", "ok");
  };

  const fileList = Object.values(store.files);
  const findingList = Object.values(store.findings);
  const pendingCount = store.stats.pending;

  const navItems = [
    { id: "files" as const, icon: Files, label: "Files", badge: fileList.length || null },
    { id: "findings" as const, icon: Bot, label: "Findings", badge: pendingCount || null },
    { id: "timeline" as const, icon: Clock, label: "Timeline", badge: null },
    { id: "config" as const, icon: Settings, label: "Config", badge: null },
  ];

  return (
    <div className="h-screen bg-void flex flex-col overflow-hidden" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Drop overlay */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-azure/10 border-2 border-dashed border-azure/50 flex items-center justify-center backdrop-blur-sm"
          >
            <div className="text-center">
              <Upload className="w-12 h-12 text-azure mx-auto mb-3" />
              <p className="font-display text-xl font-700 text-text">Drop files to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="flex-shrink-0 h-14 flex items-center gap-3 px-4 bg-ink border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-azure flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-700 text-sm">CodeAgent</span>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          className="text-sm text-ghost hover:text-text transition-colors px-2 py-1 rounded hover:bg-card"
          onClick={() => {
            const n = prompt("Project name:", store.projectName);
            if (n) store.setProjectName(n);
          }}
        >
          {store.projectName}
        </button>

        <div className="flex-1" />

        {/* Status */}
        {store.agentRunning && (
          <div className="flex items-center gap-2 text-xs text-azure bg-azure/8 border border-azure/20 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-azure animate-pulse" />
            <span className="max-w-[200px] truncate">{store.statusMessage || "Running…"}</span>
          </div>
        )}

        {/* Stats pills */}
        <div className="hidden sm:flex items-center gap-2">
          {store.stats.approved > 0 && (
            <span className="text-xs text-emerald bg-emerald/8 border border-emerald/20 px-2 py-1 rounded-full">
              {store.stats.approved} applied
            </span>
          )}
          {store.stats.pending > 0 && (
            <span className="text-xs text-amber bg-amber/8 border border-amber/20 px-2 py-1 rounded-full">
              {store.stats.pending} pending
            </span>
          )}
        </div>

        <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-card text-ghost hover:text-text transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-ink border-r border-border flex flex-col">
          {/* Nav */}
          <nav className="p-2 space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => store.setActiveView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  store.activeView === item.id
                    ? "bg-azure/10 text-azure border border-azure/15"
                    : "text-ghost hover:bg-card hover:text-soft"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {item.badge ? (
                  <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    item.id === "findings" ? "bg-amber text-void" : "bg-muted text-soft"
                  }`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="mx-3 my-1 h-px bg-border" />

          {/* Mode selector */}
          <div className="px-3 py-2">
            <p className="text-[10px] font-600 text-dim uppercase tracking-widest mb-2">Mode</p>
            <div className="space-y-1">
              {([
                { id: "review" as AgentMode, icon: Search, label: "Review", sub: "Bugs & issues" },
                { id: "optimize" as AgentMode, icon: Rocket, label: "Optimize", sub: "Performance" },
                { id: "pipeline" as AgentMode, icon: Sparkles, label: "Pipeline", sub: "Full run" },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => store.setSelectedMode(m.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left ${
                    store.selectedMode === m.id
                      ? "bg-violet/10 border border-violet/20 text-violet"
                      : "hover:bg-card text-ghost hover:text-soft border border-transparent"
                  }`}
                >
                  <m.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-600">{m.label}</div>
                    <div className="text-[10px] text-dim">{m.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          {store.agentRunning && store.totalPasses > 0 && (
            <div className="px-3 py-2">
              <div className="flex justify-between text-[10px] text-dim mb-1">
                <span>Pass {store.currentPass}/{store.totalPasses}</span>
                <span>{Math.round((store.currentPass / store.totalPasses) * 100)}%</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-azure rounded-full"
                  animate={{ width: `${(store.currentPass / store.totalPasses) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}

          <div className="flex-1" />

          {/* Run button */}
          <div className="p-3">
            {store.agentRunning ? (
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose/10 border border-rose/25 text-rose text-sm font-600 hover:bg-rose/18 transition-colors"
              >
                <Square className="w-4 h-4" /> Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={fileList.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-azure text-white text-sm font-display font-700 shadow-lg shadow-azure/20 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Play className="w-4 h-4" /> Run Agent
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* FILES view */}
          {store.activeView === "files" && (
            <div className="flex-1 flex overflow-hidden">
              {/* File tree */}
              <div className="w-56 flex-shrink-0 border-r border-border flex flex-col bg-surface/50">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <span className="text-[10px] font-700 text-dim uppercase tracking-widest">Files</span>
                  {fileList.length > 0 && (
                    <button
                      onClick={() => { store.clearFiles(); showToast("Files cleared"); }}
                      className="text-[10px] text-dim hover:text-rose transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Drop zone */}
                {/* GitHub Import */}
                <div className="mx-2 mt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <GitBranch className="w-3 h-3 text-dim" />
                    <span className="text-[10px] font-600 text-dim uppercase tracking-wider">Import from GitHub</span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={ghUrl}
                      onChange={e => setGhUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleGitHubImport()}
                      placeholder="github.com/user/repo"
                      className="flex-1 min-w-0 bg-surface border border-border rounded-md px-2 py-1.5 text-[11px] font-mono text-text placeholder:text-dim outline-none focus:border-azure/50"
                    />
                    <button
                      onClick={handleGitHubImport}
                      disabled={ghLoading || !ghUrl.trim()}
                      className="px-2 py-1.5 rounded-md bg-azure/10 border border-azure/20 text-azure text-[10px] font-600 hover:bg-azure/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {ghLoading ? "Loading..." : "Import"}
                    </button>
                  </div>
                </div>

                <div className="mx-2 my-1.5 flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] text-dim">OR</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                                <label className="mx-2 mt-2 mb-1 flex flex-col items-center justify-center gap-1.5 border border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-azure/40 hover:bg-azure/4 transition-all">
                  <Upload className="w-5 h-5 text-dim" />
                  <span className="text-[10px] text-dim text-center">Click or drop files</span>
                  <input type="file" multiple className="hidden" onChange={(e) => {
                    if (e.target.files) onDrop(Array.from(e.target.files));
                  }} />
                </label>

                {/* File list */}
                <div className="flex-1 overflow-y-auto py-1">
                  {fileList.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => store.selectFile(f.path)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                        store.selectedFile === f.path
                          ? "bg-azure/10 text-azure"
                          : "text-ghost hover:bg-card hover:text-soft"
                      }`}
                    >
                      <span className="text-sm">{fileIcon(f.path)}</span>
                      <span className="flex-1 text-[11px] font-mono truncate">{f.path}</span>
                      <span className="text-[10px] text-dim">{fmtSize(f.size)}</span>
                    </button>
                  ))}
                  {fileList.length === 0 && (
                    <p className="text-[11px] text-dim text-center py-6">No files yet</p>
                  )}
                </div>
              </div>

              {/* Code preview */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {store.selectedFile && store.files[store.selectedFile] ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/30">
                      <Code className="w-3.5 h-3.5 text-dim" />
                      <span className="text-xs font-mono text-ghost">{store.selectedFile}</span>
                    </div>
                    <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-soft">
                      <code>{store.files[store.selectedFile].content}</code>
                    </pre>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dim">
                    <Eye className="w-8 h-8" />
                    <p className="text-sm">Select a file to preview</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FINDINGS view */}
          {store.activeView === "findings" && (
            <div className="flex-1 overflow-y-auto p-4">
              {findingList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-dim">
                  <Bot className="w-12 h-12" />
                  <div className="text-center">
                    <p className="font-display text-base font-600 text-ghost mb-1">No findings yet</p>
                    <p className="text-sm">Upload files and run the agent to see results</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-2">
                  {/* Group by file */}
                  {Object.entries(
                    findingList.reduce<Record<string, Finding[]>>((acc, f) => {
                      (acc[f.file] = acc[f.file] || []).push(f);
                      return acc;
                    }, {})
                  ).map(([file, findings]) => (
                    <div key={file} className="mb-5">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-sm">{fileIcon(file)}</span>
                        <span className="text-xs font-mono text-ghost">{file}</span>
                        <span className="text-xs text-dim">({findings.length})</span>
                        <div className="flex-1 h-px bg-border" />
                        {findings.some(f => f.status === "pending") && (
                          <button
                            onClick={() => findings.filter(f => f.status === "pending").forEach(f => store.approveFinding(f.id))}
                            className="text-[10px] text-emerald hover:text-emerald/80 flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3 h-3" /> Apply all
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {findings.map(f => <FindingCard key={f.id} finding={f} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TIMELINE view */}
          {store.activeView === "timeline" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-xl mx-auto">
                {store.timeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 text-dim">
                    <Clock className="w-8 h-8" />
                    <p className="text-sm">No events yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {store.timeline.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex gap-3 items-start py-2.5 border-b border-border/50"
                      >
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          entry.type === "approved" ? "bg-emerald" :
                          entry.type === "rejected" ? "bg-rose/60" :
                          entry.type === "error" ? "bg-rose" : "bg-azure/60"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-soft">{entry.message}</p>
                          <p className="text-[10px] text-dim font-mono mt-0.5">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONFIG view */}
          {store.activeView === "config" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-lg mx-auto space-y-4">

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-surface/50">
                    <p className="text-[11px] font-700 text-dim uppercase tracking-widest">API</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs text-ghost mb-1.5">Provider</label>
                      <select
                        value={store.config.provider}
                        onChange={e => {
                          const val = e.target.value as "openrouter" | "gemini" | "local";
                          if (val === "local") {
                            store.setConfig({ provider: "local" as any, model: "", apiKey: "" });
                            setLocalStatus("idle");
                          } else {
                            store.setConfig({ provider: val, model: val === "gemini" ? GEM_MODELS[0][0] : OR_MODELS[0][0] });
                          }
                        }}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-azure/50"
                      >
                        <option value="openrouter">OpenRouter</option>
                        <option value="gemini">Google AI Studio</option>
                        <option value="local">Local LLM (LM Studio)</option>
                      </select>
                    </div>

                    {store.config.provider === "local" ? (
                      <div className="space-y-3">
                        {/* Status Panel */}
                        <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-violet-400" />
                              <span className="text-xs font-600 text-violet-300">LM Studio</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-500 ${
                                localStatus === "connected" ? "bg-emerald/15 text-emerald" :
                                localStatus === "scanning" ? "bg-amber/15 text-amber" :
                                localStatus === "offline" ? "bg-rose/15 text-rose" :
                                "bg-dim/15 text-dim"
                              }`}>
                                {localStatus === "connected" && <Wifi className="w-3 h-3 inline mr-1" />}
                                {localStatus === "offline" && <WifiOff className="w-3 h-3 inline mr-1" />}
                                {localStatus === "connected" ? "Connected" :
                                 localStatus === "scanning" ? "Scanning..." :
                                 localStatus === "offline" ? "Offline" : "Not scanned"}
                              </span>
                              <button
                                onClick={scanLocalModels}
                                disabled={localStatus === "scanning"}
                                className={`p-1 rounded-md hover:bg-violet-500/20 transition-colors ${localStatus === "scanning" ? "animate-spin" : ""}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
                              </button>
                            </div>
                          </div>
                          {localMessage && (
                            <p className="text-[10px] text-dim mt-1">{localMessage}</p>
                          )}
                        </div>

                        {/* Model select for local models */}
                        {localModels.length > 0 && (
                          <div>
                            <label className="block text-xs text-ghost mb-1.5">Model</label>
                            <select
                              value={store.config.model}
                              onChange={e => store.setConfig({ model: e.target.value })}
                              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-violet-500/50"
                            >
                              {localModels.map(m => (
                                <option key={m.id} value={m.id}>{m.id}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Setup Guide */}
                        <div className="rounded-lg border border-border bg-surface/50 p-3">
                          <p className="text-[11px] font-600 text-ghost mb-2">Setup Guide</p>
                          <ol className="text-[10px] text-dim space-y-1.5 list-decimal list-inside">
                            <li>Download &amp; install <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">LM Studio</a></li>
                            <li>Download a model (e.g. Llama, Mistral, Qwen)</li>
                            <li>Start the local server (Developer &rarr; Start Server)</li>
                            <li>Click the scan button above to detect models</li>
                          </ol>
                        </div>

                        <p className="text-[10px] text-emerald/80 flex items-center gap-1">
                          <Check className="w-3 h-3" /> No API key needed!
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-ghost mb-1.5">API Key</label>
                          <input
                            type="password"
                            value={store.config.apiKey}
                            onChange={e => store.setConfig({ apiKey: e.target.value })}
                            placeholder={store.config.provider === "openrouter" ? "sk-or-v1-..." : "AIza..."}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-text placeholder:text-dim outline-none focus:border-azure/50"
                          />
                          <p className="text-[10px] text-dim mt-1">
                            {store.config.provider === "openrouter"
                              ? "openrouter.ai/keys — free account includes ⭐ models"
                              : "aistudio.google.com/apikey"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs text-ghost mb-1.5">Model</label>
                          <select
                            value={store.config.model}
                            onChange={e => store.setConfig({ model: e.target.value })}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-azure/50"
                          >
                            {(store.config.provider === "gemini" ? GEM_MODELS : OR_MODELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-surface/50">
                    <p className="text-[11px] font-700 text-dim uppercase tracking-widest">Behaviour</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs text-ghost mb-1.5">Aggressiveness</label>
                      <select
                        value={store.config.aggression}
                        onChange={e => store.setConfig({ aggression: e.target.value as "conservative" | "balanced" | "aggressive" })}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-azure/50"
                      >
                        <option value="conservative">Conservative — critical issues only</option>
                        <option value="balanced">Balanced — issues + improvements</option>
                        <option value="aggressive">Aggressive — everything incl. style</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ghost">Auto-apply info-level fixes</span>
                      <button
                        onClick={() => store.setConfig({ autoApproveInfo: !store.config.autoApproveInfo })}
                        className={`relative w-9 h-5 rounded-full transition-colors ${store.config.autoApproveInfo ? "bg-azure" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${store.config.autoApproveInfo ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-surface/50">
                    <p className="text-[11px] font-700 text-dim uppercase tracking-widest">Focus Areas</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-2">
                    {["bugs", "security", "performance", "quality", "accessibility", "seo"].map(area => (
                      <label key={area} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={store.config.focus.includes(area)}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...store.config.focus, area]
                              : store.config.focus.filter(f => f !== area);
                            store.setConfig({ focus: next });
                          }}
                          className="accent-azure w-3.5 h-3.5"
                        />
                        <span className="text-sm text-ghost group-hover:text-soft transition-colors capitalize">{area}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => { showToast("Config saved!", "ok"); }}
                  className="px-5 py-2.5 bg-azure text-white text-sm font-600 font-display rounded-lg hover:bg-azure/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            className={`fixed bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border shadow-xl shadow-black/40 z-50 ${
              toast.type === "ok"
                ? "bg-emerald/10 border-emerald/25 text-emerald"
                : "bg-rose/10 border-rose/25 text-rose"
            }`}
          >
            {toast.type === "ok" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
