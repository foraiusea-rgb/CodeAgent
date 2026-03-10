import { create } from "zustand";

export type Severity = "critical" | "warning" | "info";
export type DiffStatus = "pending" | "approved" | "rejected";
export type AgentMode = "review" | "optimize" | "pipeline";
export type Provider = "openrouter" | "gemini";

export interface CodeFile {
  path: string;
  content: string;
  size: number;
  language: string;
}

export interface Finding {
  id: string;
  file: string;
  line_start?: number;
  line_end?: number;
  severity: Severity;
  category: string;
  title: string;
  explanation: string;
  old_code?: string;
  new_code?: string;
  impact?: string;
  status: DiffStatus;
  pass: number;
  mode: AgentMode;
  timestamp: string;
}

export interface TimelineEntry {
  id: string;
  message: string;
  type: "system" | "approved" | "rejected" | "error";
  timestamp: string;
}

export interface Config {
  apiKey: string;
  provider: Provider;
  model: string;
  aggression: "conservative" | "balanced" | "aggressive";
  autoApproveInfo: boolean;
  focus: string[];
}

interface AppState {
  // Files
  files: Record<string, CodeFile>;
  selectedFile: string | null;
  addFiles: (files: CodeFile[]) => void;
  clearFiles: () => void;
  selectFile: (path: string | null) => void;

  // Findings
  findings: Record<string, Finding>;
  addFindings: (findings: Finding[]) => void;
  approveFinding: (id: string) => void;
  rejectFinding: (id: string) => void;
  clearFindings: () => void;

  // Agent
  agentRunning: boolean;
  agentMode: AgentMode | null;
  currentPass: number;
  totalPasses: number;
  statusMessage: string;
  setAgentRunning: (v: boolean, mode?: AgentMode | null) => void;
  setAgentStatus: (msg: string) => void;
  setProgress: (current: number, total: number) => void;

  // Stats
  stats: { approved: number; rejected: number; pending: number };
  recomputeStats: () => void;

  // Timeline
  timeline: TimelineEntry[];
  addTimeline: (entry: Omit<TimelineEntry, "id" | "timestamp">) => void;

  // Config
  config: Config;
  setConfig: (c: Partial<Config>) => void;

  // UI
  activeView: "files" | "findings" | "timeline" | "config";
  selectedMode: AgentMode;
  setActiveView: (v: AppState["activeView"]) => void;
  setSelectedMode: (m: AgentMode) => void;
  projectName: string;
  setProjectName: (n: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  files: {},
  selectedFile: null,
  addFiles: (newFiles) =>
    set((s) => ({
      files: {
        ...s.files,
        ...Object.fromEntries(newFiles.map((f) => [f.path, f])),
      },
    })),
  clearFiles: () => set({ files: {}, selectedFile: null }),
  selectFile: (path) => set({ selectedFile: path }),

  findings: {},
  addFindings: (newFindings) => {
    set((s) => ({
      findings: {
        ...s.findings,
        ...Object.fromEntries(newFindings.map((f) => [f.id, f])),
      },
    }));
    get().recomputeStats();
  },
  approveFinding: (id) => {
    const f = get().findings[id];
    if (!f || f.status !== "pending") return;

    // Apply the code change
    if (f.old_code && f.new_code && f.file) {
      const file = get().files[f.file];
      if (file) {
        const updated = file.content.replace(f.old_code, f.new_code);
        set((s) => ({
          files: { ...s.files, [f.file]: { ...file, content: updated } },
        }));
      }
    }

    set((s) => ({
      findings: { ...s.findings, [id]: { ...s.findings[id], status: "approved" } },
    }));
    get().addTimeline({ message: `Applied: ${f.title}`, type: "approved" });
    get().recomputeStats();
  },
  rejectFinding: (id) => {
    const f = get().findings[id];
    if (!f || f.status !== "pending") return;
    set((s) => ({
      findings: { ...s.findings, [id]: { ...s.findings[id], status: "rejected" } },
    }));
    get().addTimeline({ message: `Skipped: ${f.title}`, type: "rejected" });
    get().recomputeStats();
  },
  clearFindings: () => set({ findings: {}, stats: { approved: 0, rejected: 0, pending: 0 } }),

  agentRunning: false,
  agentMode: null,
  currentPass: 0,
  totalPasses: 0,
  statusMessage: "",
  setAgentRunning: (v, mode = null) => set({ agentRunning: v, agentMode: mode }),
  setAgentStatus: (msg) => set({ statusMessage: msg }),
  setProgress: (current, total) => set({ currentPass: current, totalPasses: total }),

  stats: { approved: 0, rejected: 0, pending: 0 },
  recomputeStats: () => {
    const all = Object.values(get().findings);
    set({
      stats: {
        approved: all.filter((f) => f.status === "approved").length,
        rejected: all.filter((f) => f.status === "rejected").length,
        pending: all.filter((f) => f.status === "pending").length,
      },
    });
  },

  timeline: [],
  addTimeline: (entry) =>
    set((s) => ({
      timeline: [
        {
          ...entry,
          id: Math.random().toString(36).slice(2),
          timestamp: new Date().toISOString(),
        },
        ...s.timeline,
      ].slice(0, 100),
    })),

  config: {
    apiKey: "",
    provider: "openrouter",
    model: "deepseek/deepseek-r1-0528:free",
    aggression: "balanced",
    autoApproveInfo: false,
    focus: ["bugs", "security", "performance", "quality"],
  },
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),

  activeView: "files",
  selectedMode: "review",
  setActiveView: (v) => set({ activeView: v }),
  setSelectedMode: (m) => set({ selectedMode: m }),
  projectName: "Untitled Project",
  setProjectName: (n) => set({ projectName: n }),
}));
