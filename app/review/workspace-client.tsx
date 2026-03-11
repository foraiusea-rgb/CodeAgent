"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Zap, Files, Bot, Clock, Settings, Play, Square, Download, Monitor, RefreshCw, Wifi, WifiOff,
  ChevronRight, ChevronLeft, Check, X, AlertTriangle, Info, AlertCircle,
  Upload, Eye, Code, GitBranch, Link, Sparkles, Search, Rocket, Activity, ArrowUp, ArrowDown, Timer,
  FileCode2, FileJson, FileText, FileType, Hash, Gem, Terminal, Globe, Palette, Cpu, Pencil,
  PanelLeftClose, PanelLeft, Sun, Moon, Laptop,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { runAgent } from "@/lib/agent";
import { chunkAllFiles, embedChunks, embedQuery, searchEmbeddings, findSimilarCode } from "@/lib/embeddings";
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

// SVG icon + color per file extension (replaces emoji for accessibility + crispness)
const FILE_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  ts: { icon: FileCode2, color: "text-azure" },
  tsx: { icon: FileCode2, color: "text-azure" },
  js: { icon: FileCode2, color: "text-amber" },
  jsx: { icon: FileCode2, color: "text-amber" },
  py: { icon: FileCode2, color: "text-emerald" },
  rb: { icon: Gem, color: "text-rose" },
  go: { icon: Cpu, color: "text-azure/70" },
  rs: { icon: Cpu, color: "text-amber/80" },
  java: { icon: FileCode2, color: "text-rose/80" },
  css: { icon: Palette, color: "text-violet" },
  html: { icon: Globe, color: "text-amber" },
  json: { icon: FileJson, color: "text-amber/60" },
  md: { icon: FileText, color: "text-ghost" },
  sh: { icon: Terminal, color: "text-emerald/70" },
  vue: { icon: FileCode2, color: "text-emerald" },
  svelte: { icon: FileCode2, color: "text-amber" },
  php: { icon: FileCode2, color: "text-violet/70" },
  swift: { icon: FileCode2, color: "text-amber" },
  kt: { icon: FileCode2, color: "text-violet" },
};

function FileIcon({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const cfg = FILE_ICON_MAP[ext] || { icon: FileType, color: "text-dim" };
  const Icon = cfg.icon;
  return <Icon className={`${className} ${cfg.color} flex-shrink-0`} />;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1048576).toFixed(1)}M`;
}

function fmtElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(2)}M`;
}

const SEV_CONFIG = {
  critical: { icon: AlertCircle, color: "text-rose", bg: "bg-rose/10", border: "border-rose/25", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-amber", bg: "bg-amber/10", border: "border-amber/25", label: "Warning" },
  info: { icon: Info, color: "text-azure", bg: "bg-azure/10", border: "border-azure/25", label: "Info" },
};

const OR_MODELS = [
  ["openrouter/free", "Auto (picks best free model)"],
  ["qwen/qwen3-coder:free", "Qwen3 Coder"],
  ["qwen/qwen3-next-80b-a3b-instruct:free", "Qwen3 Next 80B-A3B"],
  ["openai/gpt-oss-120b:free", "GPT-OSS 120B"],
  ["nousresearch/hermes-3-llama-3.1-405b:free", "Hermes 3 Llama 405B"],
  ["meta-llama/llama-3.3-70b-instruct:free", "Llama 3.3 70B"],
  ["google/gemma-3-27b-it:free", "Gemma 3 27B"],
  ["google/gemma-3-12b-it:free", "Gemma 3 12B"],
  ["mistralai/mistral-small-3.1-24b-instruct:free", "Mistral Small 3.1 24B"],
  ["nvidia/nemotron-3-nano-30b-a3b:free", "Nemotron 3 Nano 30B"],
  ["nvidia/nemotron-nano-9b-v2:free", "Nemotron Nano 9B"],
  ["nvidia/nemotron-nano-12b-v2-vl:free", "Nemotron Nano 12B VL"],
  ["stepfun/step-3.5-flash:free", "Step 3.5 Flash"],
  ["z-ai/glm-4.5-air:free", "GLM 4.5 Air"],
  ["arcee-ai/trinity-large-preview:free", "Trinity Large"],
  ["arcee-ai/trinity-mini:free", "Trinity Mini"],
  ["cognitivecomputations/dolphin-mistral-24b-venice-edition:free", "Dolphin Mistral 24B"],
  ["qwen/qwen3-4b:free", "Qwen3 4B"],
  ["google/gemma-3-4b-it:free", "Gemma 3 4B"],
  ["google/gemma-3n-e4b-it:free", "Gemma 3n E4B"],
  ["google/gemma-3n-e2b-it:free", "Gemma 3n E2B"],
  ["liquid/lfm-2.5-1.2b-thinking:free", "LFM 2.5 1.2B Thinking"],
  ["liquid/lfm-2.5-1.2b-instruct:free", "LFM 2.5 1.2B Instruct"],
  ["openai/gpt-oss-20b:free", "GPT-OSS 20B"],
  ["meta-llama/llama-3.2-3b-instruct:free", "Llama 3.2 3B"],
  ["nvidia/llama-nemotron-embed-vl-1b-v2:free", "Nemotron Embed VL 1B"],
];
const GEM_MODELS = [
  ["gemini-2.5-flash", "Gemini 2.5 Flash"],
  ["gemini-2.5-pro", "Gemini 2.5 Pro"],
  ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"],
  ["gemini-2.0-flash", "Gemini 2.0 Flash"],
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
      className={`relative rounded-xl border overflow-hidden transition-colors duration-200 ${
        finding.status === "approved"
          ? "border-emerald/25 bg-emerald/4 opacity-70"
          : finding.status === "rejected"
          ? "border-border bg-card/30 opacity-50"
          : "border-border bg-card hover:border-muted"
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
          className="w-full text-left p-3.5 flex items-start gap-3 min-h-[44px]"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${sev.label}: ${finding.title}. Click to ${expanded ? "collapse" : "expand"} details.`}
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
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
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
                      aria-label={`Apply fix: ${finding.title}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-emerald/10 border border-emerald/25 text-emerald hover:bg-emerald/18 transition-colors duration-150 min-h-[36px]"
                    >
                      <Check className="w-3.5 h-3.5" /> Apply fix
                    </button>
                    <button
                      onClick={() => rejectFinding(finding.id)}
                      aria-label={`Skip finding: ${finding.title}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-card border border-border text-ghost hover:text-text hover:border-muted transition-colors duration-150 min-h-[36px]"
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
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Theme effect — apply class to html element
  useEffect(() => {
    const root = document.documentElement;
    if (store.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      root.classList.toggle("light", mq.matches);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle("light", e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    root.classList.toggle("light", store.theme === "light");
  }, [store.theme]);

  // Load API key from session + migrate stale Gemini model IDs
  useEffect(() => {
    const key = sessionStorage.getItem("ca_api_key");
    const prov = sessionStorage.getItem("ca_provider") as "openrouter" | "gemini" | "local" | null;
    if (prov === "local") {
      store.setConfig({ provider: "local", apiKey: "", model: "" });
    } else if (key) {
      store.setConfig({ apiKey: key, provider: prov || "openrouter" });
    }

    // Auto-fix retired/expired Gemini model IDs persisted in localStorage
    const RETIRED_GEMINI: Record<string, string> = {
      "gemini-2.5-pro-preview-06-05": "gemini-2.5-pro",
      "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro",
      "gemini-1.5-pro": "gemini-2.5-flash",
      "gemini-1.5-flash": "gemini-2.5-flash",
      "gemini-1.0-pro": "gemini-2.5-flash",
    };
    const currentModel = useStore.getState().config.model;
    if (RETIRED_GEMINI[currentModel]) {
      store.setConfig({ model: RETIRED_GEMINI[currentModel] });
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

  // Resolve the embedding API key
  const embeddingKey = store.config.embeddingApiKey || (store.config.provider === "gemini" ? store.config.apiKey : "");

  const handleEmbed = async () => {
    if (!embeddingKey) {
      showToast("Add a Gemini API key in Config to use semantic search", "err");
      return;
    }
    try {
      store.setEmbeddingStatus("embedding");
      store.setEmbeddingProgress("Chunking files...");

      // Only embed new/changed files
      const existingIds = new Set(store.embeddedChunks.map((c) => c.id));
      const allChunks = chunkAllFiles(store.files);
      const newChunks = allChunks.filter((c) => !existingIds.has(c.id));

      if (newChunks.length === 0) {
        store.setEmbeddingStatus("ready");
        store.setEmbeddingProgress("");
        showToast("All files already indexed", "ok");
        return;
      }

      store.setEmbeddingProgress(`Embedding ${newChunks.length} chunks...`);

      const embedded = await embedChunks(newChunks, embeddingKey, (done, total) => {
        store.setEmbeddingProgress(`Embedding ${done}/${total} chunks...`);
      });

      if (existingIds.size > 0) {
        store.addEmbeddedChunks(embedded);
      } else {
        store.setEmbeddedChunks(embedded);
      }
      store.setEmbeddingProgress("");
      store.addTimeline({ message: `Indexed ${embedded.length} code chunks for semantic search`, type: "system" });
      showToast(`Embedded ${embedded.length} chunks!`, "ok");
    } catch (err) {
      store.setEmbeddingStatus("error");
      store.setEmbeddingProgress(err instanceof Error ? err.message : "Embedding failed");
      showToast(err instanceof Error ? err.message : "Embedding failed", "err");
    }
  };

  const handleSearch = async () => {
    if (!store.searchQuery.trim() || store.embeddedChunks.length === 0) return;
    if (!embeddingKey) {
      showToast("Add a Gemini API key in Config", "err");
      return;
    }
    try {
      store.setSearchLoading(true);
      const queryEmbedding = await embedQuery(store.searchQuery, embeddingKey);
      const results = searchEmbeddings(queryEmbedding, store.embeddedChunks, 20, 0.25);
      store.setSearchResults(results);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Search failed", "err");
    } finally {
      store.setSearchLoading(false);
    }
  };

  const handleFindSimilar = (filePath: string) => {
    const matchingChunks = store.embeddedChunks.filter((c) => c.filePath === filePath);
    if (matchingChunks.length > 0) {
      const results = findSimilarCode(matchingChunks[0], store.embeddedChunks, 10, 0.4);
      store.setSearchResults(results);
      store.setSearchQuery(`Similar to: ${filePath}`);
      store.setActiveView("search");
    }
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
    { id: "search" as const, icon: Search, label: "Search", badge: store.embeddingStatus === "ready" ? store.embeddedChunks.length : null },
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
      <header className="flex-shrink-0 h-14 flex items-center gap-3 px-4 bg-ink border-b border-border" role="banner">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-azure flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-700 text-sm">CodeAgent</span>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { if (nameInput.trim()) store.setProjectName(nameInput.trim()); setEditingName(false); }
                if (e.key === "Escape") setEditingName(false);
              }}
              onBlur={() => { if (nameInput.trim()) store.setProjectName(nameInput.trim()); setEditingName(false); }}
              className="bg-surface border border-azure/40 rounded-md px-2 py-1 text-sm text-text outline-none w-40 font-sans"
              aria-label="Edit project name"
            />
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 text-sm text-ghost hover:text-text transition-colors px-2 py-1 rounded hover:bg-card min-h-[36px]"
            onClick={() => { setNameInput(store.projectName); setEditingName(true); }}
            aria-label="Click to edit project name"
          >
            {store.projectName}
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-dim" />
          </button>
        )}

        {/* Sidebar toggle */}
        <button
          onClick={() => store.setSidebarOpen(!store.sidebarOpen)}
          aria-label={store.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="p-2 rounded-lg hover:bg-card text-ghost hover:text-text transition-colors duration-150 min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          {store.sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>

        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          onClick={() => store.setTheme(store.theme === "dark" ? "light" : store.theme === "light" ? "system" : "dark")}
          aria-label={`Theme: ${store.theme}. Click to change.`}
          className="p-2 rounded-lg hover:bg-card text-ghost hover:text-text transition-colors duration-150 min-w-[36px] min-h-[36px] flex items-center justify-center"
          title={`Theme: ${store.theme}`}
        >
          {store.theme === "dark" ? <Moon className="w-4 h-4" /> : store.theme === "light" ? <Sun className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
        </button>

        {/* Status */}
        {store.agentRunning && (
          <div className="flex items-center gap-2 text-xs text-azure bg-azure/8 border border-azure/20 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-azure animate-pulse" />
            <span className="max-w-[200px] truncate">{store.statusMessage || "Running..."}</span>
            {store.elapsedTime > 0 && (
              <span className="text-dim font-mono">{fmtElapsed(store.elapsedTime)}</span>
            )}
          </div>
        )}

        {/* Token Usage Button */}
        {(store.agentRunning || store.tokenUsage.totalTokens > 0) && (
          <div className="relative">
            <button
              onClick={() => setShowTokenDialog(!showTokenDialog)}
              className="flex items-center gap-1.5 text-xs text-violet bg-violet/8 border border-violet/20 px-2.5 py-1.5 rounded-full hover:bg-violet/15 transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="font-mono">{fmtTokens(store.tokenUsage.totalTokens)}</span>
            </button>

            {/* Token Usage Dialog */}
            <AnimatePresence>
              {showTokenDialog && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-2xl shadow-black/50 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border bg-surface/50">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-700 text-dim uppercase tracking-widest">Token Usage</p>
                      <button onClick={() => setShowTokenDialog(false)} className="p-0.5 rounded hover:bg-muted text-dim hover:text-ghost transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Prompt Tokens */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-azure/10 flex items-center justify-center">
                          <ArrowUp className="w-3 h-3 text-azure" />
                        </div>
                        <span className="text-xs text-ghost">Prompt (sent)</span>
                      </div>
                      <span className="text-sm font-mono font-600 text-text">{fmtTokens(store.tokenUsage.promptTokens)}</span>
                    </div>
                    {/* Completion Tokens */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-emerald/10 flex items-center justify-center">
                          <ArrowDown className="w-3 h-3 text-emerald" />
                        </div>
                        <span className="text-xs text-ghost">Completion (received)</span>
                      </div>
                      <span className="text-sm font-mono font-600 text-text">{fmtTokens(store.tokenUsage.completionTokens)}</span>
                    </div>
                    {/* Divider */}
                    <div className="h-px bg-border" />
                    {/* Total */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-violet/10 flex items-center justify-center">
                          <Activity className="w-3 h-3 text-violet" />
                        </div>
                        <span className="text-xs font-600 text-ghost">Total used</span>
                      </div>
                      <span className="text-sm font-mono font-700 text-violet">{fmtTokens(store.tokenUsage.totalTokens)}</span>
                    </div>
                    {/* Elapsed time */}
                    {store.elapsedTime > 0 && (
                      <>
                        <div className="h-px bg-border" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-amber/10 flex items-center justify-center">
                              <Timer className="w-3 h-3 text-amber" />
                            </div>
                            <span className="text-xs text-ghost">Elapsed time</span>
                          </div>
                          <span className="text-sm font-mono font-600 text-text">{fmtElapsed(store.elapsedTime)}</span>
                        </div>
                      </>
                    )}
                    {/* Provider info */}
                    <div className="mt-1 pt-2 border-t border-border">
                      <p className="text-[10px] text-dim">
                        Provider: <span className="text-ghost capitalize">{store.config.provider}</span>
                        {store.config.model && <> &middot; {store.config.model.split("/").pop()}</>}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

        <button
          onClick={handleDownload}
          aria-label="Download reviewed files"
          className="p-2.5 rounded-lg hover:bg-card text-ghost hover:text-text transition-colors duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Download className="w-4 h-4" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`flex-shrink-0 bg-ink border-r border-border flex flex-col transition-all duration-200 overflow-hidden ${store.sidebarOpen ? "w-56" : "w-0 border-r-0"}`} aria-label="Agent controls">
          {/* Nav */}
          <nav className="p-2 space-y-0.5" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => store.setActiveView(item.id)}
                aria-current={store.activeView === item.id ? "page" : undefined}
                aria-label={`${item.label}${item.badge ? ` (${item.badge})` : ""}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 min-h-[44px] ${
                  store.activeView === item.id
                    ? "bg-azure/10 text-azure border border-azure/15"
                    : "text-ghost hover:bg-card hover:text-soft border border-transparent"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {item.badge ? (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    item.id === "findings" ? "bg-amber text-void" : "bg-muted text-soft"
                  }`} aria-hidden="true">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="mx-3 my-1 h-px bg-border" />

          {/* Mode selector */}
          <div className="px-3 py-2" role="radiogroup" aria-label="Analysis mode">
            <p className="text-[10px] font-600 text-dim uppercase tracking-widest mb-2" id="mode-heading">Mode</p>
            <div className="space-y-1">
              {([
                { id: "review" as AgentMode, icon: Search, label: "Review", sub: "Bugs & issues" },
                { id: "optimize" as AgentMode, icon: Rocket, label: "Optimize", sub: "Performance" },
                { id: "pipeline" as AgentMode, icon: Sparkles, label: "Pipeline", sub: "Full run" },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={store.selectedMode === m.id}
                  aria-label={`${m.label} mode: ${m.sub}`}
                  onClick={() => store.setSelectedMode(m.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors duration-150 text-left min-h-[44px] ${
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

          {/* Semantic Search Controls */}
          {fileList.length > 0 && (
            <>
              <div className="mx-3 my-1 h-px bg-border" />
              <div className="px-3 py-2">
                <p className="text-[10px] font-600 text-dim uppercase tracking-widest mb-2">Semantic Search</p>
                <div className="space-y-1.5">
                  {store.embeddingStatus === "idle" && (
                    <button
                      onClick={handleEmbed}
                      disabled={!embeddingKey}
                      aria-label="Embed files for semantic search"
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-600 bg-violet/10 border border-violet/20 text-violet hover:bg-violet/20 disabled:opacity-40 transition-colors duration-150 min-h-[40px]"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Embed Files
                    </button>
                  )}
                  {store.embeddingStatus === "embedding" && (
                    <div className="text-center py-1.5">
                      <div className="text-[10px] text-violet animate-pulse">{store.embeddingProgress || "Embedding..."}</div>
                    </div>
                  )}
                  {store.embeddingStatus === "ready" && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald">
                        <Check className="w-3 h-3" />
                        {store.embeddedChunks.length} chunks
                      </div>
                      <button
                        onClick={handleEmbed}
                        className="text-[10px] text-dim hover:text-violet transition-colors"
                      >
                        Re-index
                      </button>
                    </div>
                  )}
                  {store.embeddingStatus === "error" && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-rose truncate">{store.embeddingProgress}</p>
                      <button onClick={handleEmbed} className="text-[10px] text-dim hover:text-violet transition-colors">
                        Retry
                      </button>
                    </div>
                  )}
                  {!embeddingKey && store.embeddingStatus === "idle" && (
                    <p className="text-[9px] text-dim">Requires Gemini API key in Config</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Enhanced Progress */}
          {store.agentRunning && store.totalPasses > 0 && (
            <div className="px-3 py-2 space-y-2">
              {/* Pass indicator */}
              <div className="flex justify-between text-[10px] text-dim">
                <span className="font-600">Pass {store.currentPass}/{store.totalPasses}</span>
                <span className="font-mono">{fmtElapsed(store.elapsedTime)}</span>
              </div>

              {/* Overall progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-azure rounded-full"
                  animate={{ width: `${Math.max(5, store.agentStepProgress)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
                {/* Shimmer overlay while waiting */}
                {store.agentStep.includes("Sending") && (
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                )}
              </div>

              {/* Sub-step label */}
              {store.agentStep && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-azure animate-pulse flex-shrink-0" />
                  <span className="text-[10px] text-ghost truncate">{store.agentStep}</span>
                </div>
              )}

              {/* Token counter (live) */}
              {store.tokenUsage.totalTokens > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-dim">
                  <Activity className="w-3 h-3 text-violet/60" />
                  <span className="font-mono">{fmtTokens(store.tokenUsage.totalTokens)} tokens</span>
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Run button */}
          <div className="p-3">
            {store.agentRunning ? (
              <button
                onClick={handleStop}
                aria-label="Stop the running analysis"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose/10 border border-rose/25 text-rose text-sm font-600 hover:bg-rose/18 transition-colors duration-150 min-h-[44px]"
              >
                <Square className="w-4 h-4" /> Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={fileList.length === 0}
                aria-label={fileList.length === 0 ? "Upload files first to run analysis" : `Run ${store.selectedMode} analysis on ${fileList.length} file(s)`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-azure text-white text-sm font-display font-700 hover:bg-azure/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 min-h-[44px]"
              >
                <Play className="w-4 h-4" /> Run Agent
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col" aria-label="Workspace content">
          {/* FILES view */}
          {store.activeView === "files" && (
            fileList.length === 0 ? (
              /* ── Onboarding / Upload Zone ── */
              <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
                <div className="max-w-xl w-full">
                  {/* Step indicator */}
                  <div className="flex items-center justify-center gap-1 mb-10">
                    {[
                      { num: 1, label: "Upload", active: true },
                      { num: 2, label: "Configure", active: false },
                      { num: 3, label: "Analyze", active: false },
                      { num: 4, label: "Review", active: false },
                    ].map((step, i) => (
                      <div key={step.num} className="flex items-center gap-1">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
                          step.active
                            ? "bg-azure/15 text-azure border border-azure/25"
                            : "bg-card text-dim border border-border"
                        }`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            step.active ? "bg-azure text-white" : "bg-muted text-dim"
                          }`}>{step.num}</span>
                          {step.label}
                        </div>
                        {i < 3 && <div className="w-6 h-px bg-border" />}
                      </div>
                    ))}
                  </div>

                  {/* Big upload dropzone */}
                  <label className="block rounded-2xl border-2 border-dashed border-border bg-card/40 p-12 text-center cursor-pointer hover:border-azure/40 hover:bg-azure/3 transition-colors duration-200 group">
                    <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-5 group-hover:border-azure/30 transition-colors">
                      <Upload className="w-8 h-8 text-ghost group-hover:text-azure transition-colors" />
                    </div>
                    <h2 className="font-display text-xl font-700 text-text mb-2">Drop your code here</h2>
                    <p className="text-sm text-ghost mb-1">or click to browse files</p>
                    <p className="text-xs text-dim">Supports .ts, .tsx, .js, .py, .go, .rs, .java, .json and more</p>
                    <input type="file" multiple className="hidden" onChange={(e) => {
                      if (e.target.files) onDrop(Array.from(e.target.files));
                    }} />
                  </label>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-dim font-medium">or import from GitHub</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* GitHub import */}
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2.5 focus-within:border-azure/50 transition-colors">
                      <GitBranch className="w-4 h-4 text-dim flex-shrink-0" />
                      <input
                        type="text"
                        value={ghUrl}
                        onChange={e => setGhUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleGitHubImport()}
                        placeholder="github.com/user/repo"
                        className="flex-1 bg-transparent text-sm font-mono text-text placeholder:text-dim outline-none"
                      />
                    </div>
                    <button
                      onClick={handleGitHubImport}
                      disabled={ghLoading || !ghUrl.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-azure text-white text-sm font-600 hover:bg-azure/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 min-h-[44px]"
                    >
                      {ghLoading ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importing...</>
                      ) : (
                        <><Download className="w-3.5 h-3.5" /> Import</>
                      )}
                    </button>
                  </div>

                  {/* Quick tip */}
                  <div className="mt-8 text-center">
                    <p className="text-xs text-dim">
                      After uploading, configure the analysis mode in the sidebar, then hit <span className="text-ghost font-medium">Run Agent</span>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Normal Files View (with files loaded) ── */
              <div className="flex-1 flex overflow-hidden">
                {/* File tree */}
                <div className="w-56 flex-shrink-0 border-r border-border flex flex-col bg-surface/50">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                    <span className="text-[10px] font-700 text-dim uppercase tracking-widest">Files ({fileList.length})</span>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-dim hover:text-azure transition-colors cursor-pointer">
                        + Add
                        <input type="file" multiple className="hidden" onChange={(e) => {
                          if (e.target.files) onDrop(Array.from(e.target.files));
                        }} />
                      </label>
                      <button
                        onClick={() => { store.clearFiles(); showToast("Files cleared"); }}
                        className="text-[10px] text-dim hover:text-rose transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* GitHub Import (compact) */}
                  <div className="mx-2 mt-2 mb-1">
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
                        {ghLoading ? "..." : "Import"}
                      </button>
                    </div>
                  </div>

                  {/* File list */}
                  <div className="flex-1 overflow-y-auto py-1">
                    {fileList.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => store.selectFile(f.path)}
                        aria-label={`View ${f.path} (${fmtSize(f.size)})`}
                        aria-current={store.selectedFile === f.path ? "true" : undefined}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-150 min-h-[36px] ${
                          store.selectedFile === f.path
                            ? "bg-azure/10 text-azure"
                            : "text-ghost hover:bg-card hover:text-soft"
                        }`}
                      >
                        <FileIcon path={f.path} className="w-3.5 h-3.5" />
                        <span className="flex-1 text-[11px] font-mono truncate">{f.path}</span>
                        <span className="text-[10px] text-dim">{fmtSize(f.size)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code preview */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {store.selectedFile && store.files[store.selectedFile] ? (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/30">
                        <Code className="w-3.5 h-3.5 text-dim" />
                        <span className="text-xs font-mono text-ghost flex-1">{store.selectedFile}</span>
                        {store.embeddingStatus === "ready" && store.selectedFile && (
                          <button
                            onClick={() => handleFindSimilar(store.selectedFile!)}
                            className="text-[10px] text-violet hover:text-violet/80 transition-colors duration-150 px-2 py-1 rounded hover:bg-violet/8"
                          >
                            Find Similar
                          </button>
                        )}
                      </div>
                      <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-soft">
                        <code>{store.files[store.selectedFile].content}</code>
                      </pre>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-dim">
                      <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
                        <Eye className="w-6 h-6 text-ghost" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-500 text-ghost">Select a file to preview</p>
                        <p className="text-xs text-dim">Click any file in the left panel to view its contents</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* FINDINGS view */}
          {store.activeView === "findings" && (
            <div className="flex-1 overflow-y-auto p-4">
              {findingList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-5 text-dim max-w-sm mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                    <Bot className="w-7 h-7 text-ghost" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-display text-base font-600 text-ghost">No findings yet</p>
                    <p className="text-sm text-dim leading-relaxed">
                      {fileList.length === 0
                        ? "Start by uploading files or importing a GitHub repo from the Files tab."
                        : `${fileList.length} file(s) loaded. Hit "Run Agent" to start analysis.`}
                    </p>
                  </div>
                  {fileList.length > 0 && !store.agentRunning && (
                    <button
                      onClick={handleRun}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-azure text-white text-sm font-600 hover:bg-azure/90 transition-colors duration-150"
                    >
                      <Play className="w-3.5 h-3.5" /> Run Agent
                    </button>
                  )}
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
                        <FileIcon path={file} className="w-3.5 h-3.5" />
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

          {/* SEARCH view */}
          {store.activeView === "search" && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search bar */}
              <div className="px-4 py-3 border-b border-border bg-surface/30">
                <div className="flex gap-2 max-w-2xl">
                  <input
                    type="text"
                    value={store.searchQuery}
                    onChange={(e) => store.setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by meaning... e.g. 'authentication logic' or 'error handling'"
                    aria-label="Semantic search query"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-dim outline-none focus:border-violet/50"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={store.searchLoading || !store.searchQuery.trim() || store.embeddedChunks.length === 0}
                    aria-label="Run semantic search"
                    className="px-4 py-2.5 rounded-lg bg-violet text-white text-sm font-600 hover:bg-violet/90 disabled:opacity-40 transition-colors duration-150 min-h-[44px]"
                  >
                    {store.searchLoading ? "Searching..." : "Search"}
                  </button>
                </div>
                {store.embeddingStatus !== "ready" && (
                  <p className="text-[10px] text-amber mt-2">
                    Embed files first using the sidebar button to enable semantic search.
                  </p>
                )}
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto p-4">
                {store.searchResults.length === 0 && !store.searchLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-5 text-dim max-w-sm mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                      <Search className="w-7 h-7 text-ghost" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-display text-base font-600 text-ghost">Semantic Code Search</p>
                      <p className="text-sm text-dim leading-relaxed">
                        {store.embeddingStatus === "ready"
                          ? "Type a query to search your codebase by meaning — not just keywords."
                          : "Embed your files first, then search by meaning. E.g. \"find the login logic\" will find authentication code even without the word \"login\"."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-3">
                    <p className="text-xs text-dim mb-2">{store.searchResults.length} results for &ldquo;{store.searchQuery}&rdquo;</p>
                    {store.searchResults.map((result) => (
                      <button
                        key={result.chunk.id}
                        onClick={() => {
                          store.selectFile(result.chunk.filePath);
                          store.setActiveView("files");
                        }}
                        aria-label={`View ${result.chunk.filePath} lines ${result.chunk.startLine}-${result.chunk.endLine}`}
                        className="w-full text-left rounded-xl border border-border bg-card hover:border-muted p-4 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileIcon path={result.chunk.filePath} className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono text-ghost">{result.chunk.filePath}</span>
                            <span className="text-[10px] text-dim font-mono">
                              L{result.chunk.startLine}–{result.chunk.endLine}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              result.score > 0.7
                                ? "bg-emerald/10 text-emerald"
                                : result.score > 0.5
                                ? "bg-amber/10 text-amber"
                                : "bg-dim/10 text-dim"
                            }`}
                          >
                            {(result.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <pre className="text-[11px] font-mono text-soft leading-relaxed overflow-hidden max-h-20">
                          <code>{result.chunk.preview}</code>
                        </pre>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TIMELINE view */}
          {store.activeView === "timeline" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-xl mx-auto">
                {store.timeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4 text-dim">
                    <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
                      <Clock className="w-6 h-6 text-ghost" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-500 text-ghost">No events yet</p>
                      <p className="text-xs text-dim">Activity from analyses will appear here as a timeline</p>
                    </div>
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

                {/* Embedding API Key — shown when not using Gemini provider */}
                {store.config.provider !== "gemini" && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface/50">
                      <p className="text-[11px] font-700 text-dim uppercase tracking-widest">Semantic Search</p>
                    </div>
                    <div className="p-4 space-y-2">
                      <div>
                        <label className="block text-xs text-ghost mb-1.5">Gemini Embedding Key</label>
                        <input
                          type="password"
                          value={store.config.embeddingApiKey}
                          onChange={(e) => store.setConfig({ embeddingApiKey: e.target.value })}
                          placeholder="AIza... (from aistudio.google.com/apikey)"
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-text placeholder:text-dim outline-none focus:border-violet/50"
                        />
                        <p className="text-[10px] text-dim mt-1">
                          Optional — needed to use semantic search when using OpenRouter or Local provider.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                      <label htmlFor="auto-apply-toggle" className="text-sm text-ghost cursor-pointer">Auto-apply info-level fixes</label>
                      <button
                        id="auto-apply-toggle"
                        role="switch"
                        aria-checked={store.config.autoApproveInfo}
                        aria-label="Toggle auto-apply for info-level fixes"
                        onClick={() => store.setConfig({ autoApproveInfo: !store.config.autoApproveInfo })}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-150 ${store.config.autoApproveInfo ? "bg-azure" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-150 ${store.config.autoApproveInfo ? "translate-x-5" : "translate-x-0.5"}`} />
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
