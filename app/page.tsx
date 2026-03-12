"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Zap, Shield, Rocket, GitBranch, ArrowRight, CheckCircle,
  Upload, Clock, Code, Play, Pause, ChevronLeft, ChevronRight,
  AlertCircle, AlertTriangle, Info, Bug, Lock, Gauge, Sparkles,
} from "lucide-react";

const STEPS = [
  { icon: Upload, label: "Upload", desc: "Drop files or paste a GitHub URL" },
  { icon: Code, label: "Analyze", desc: "AI scans for bugs, security, performance & more" },
  { icon: CheckCircle, label: "Review", desc: "Approve or skip each suggested fix" },
  { icon: Rocket, label: "Ship", desc: "Download your improved codebase" },
];

const FEATURES = [
  { icon: Bug, label: "Bug Detection", desc: "Catch null refs, off-by-one errors, missing awaits, and race conditions before production", accent: "text-rose" },
  { icon: Gauge, label: "Performance", desc: "Flag O(n\u00B2) loops, missing memoization, N+1 queries, and unnecessary re-renders", accent: "text-amber" },
  { icon: Lock, label: "Security", desc: "Spot SQL injection, XSS, hardcoded secrets, and insecure authentication patterns", accent: "text-violet" },
  { icon: Sparkles, label: "Code Quality", desc: "Dead code removal, naming improvements, missing error handling, SOLID violations", accent: "text-emerald" },
];

const CODE_SAMPLE = `// Before CodeAgent
function getUserData(id) {
  const user = db.query("SELECT * FROM users WHERE id = " + id)
  return user.data
}

// After CodeAgent
async function getUserData(id: string): Promise<User> {
  // \u2713 Parameterized query (SQL injection fix)
  // \u2713 Added type safety
  // \u2713 Async/await pattern
  const user = await db.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  )
  return user.rows[0] ?? null
}`;

// ── Video walkthrough slides ─────────────────────────────────────────────────
const WALKTHROUGH_SLIDES = [
  {
    step: 1,
    title: "Upload your code",
    desc: "Drag & drop files into the workspace, or paste a public GitHub URL to import an entire repository. Supports 20+ languages including TypeScript, Python, Go, Rust, Java, and more.",
    detail: "CodeAgent reads up to 50 files (100KB each). It strips node_modules, .git, and build folders automatically.",
    accent: "azure",
  },
  {
    step: 2,
    title: "Choose your focus",
    desc: "Select which areas to analyze: bugs, security, performance, quality, accessibility, or SEO. Check one or all six \u2014 the AI adapts its analysis to what you care about.",
    detail: "Quick Scan does a single focused pass. Deep Analysis runs two passes \u2014 the second specifically hunts for subtle edge cases like race conditions and timing attacks.",
    accent: "violet",
  },
  {
    step: 3,
    title: "Hit Analyze",
    desc: "CodeAgent sends your code to the AI model you chose (Gemini, OpenRouter, or a local LLM). It returns structured findings with exact line numbers and one-click fixes.",
    detail: "Each finding includes: severity (critical/warning/info), category, explanation, the exact code to replace, and the improved version. Typical analysis: 30\u201390 seconds.",
    accent: "emerald",
  },
  {
    step: 4,
    title: "Review & apply fixes",
    desc: "Browse findings grouped by file. Each one shows a before/after diff. Click \"Apply fix\" to patch your code instantly, or \"Skip\" to ignore it.",
    detail: "Applied fixes modify the in-memory file. When done, download the full reviewed codebase as a JSON bundle. No changes are made to your original files.",
    accent: "amber",
  },
];

// ── Example findings with real code ──────────────────────────────────────────
const EXAMPLE_FINDINGS = [
  {
    severity: "critical",
    category: "security",
    title: "SQL Injection Vulnerability",
    file: "api/users.ts",
    line: 23,
    explanation: "User input concatenated directly into SQL query. An attacker can inject arbitrary SQL to read, modify, or delete data.",
    before: `db.query("SELECT * FROM users WHERE id = " + req.params.id)`,
    after: `db.query("SELECT * FROM users WHERE id = $1", [req.params.id])`,
    impact: "Prevents unauthorized database access",
  },
  {
    severity: "critical",
    category: "bugs",
    title: "Unhandled Promise Rejection",
    file: "lib/api-client.ts",
    line: 47,
    explanation: "Async function called without await or .catch(). If the fetch fails, the error silently disappears and downstream code gets undefined.",
    before: `function loadUser(id) {\n  fetch("/api/users/" + id)\n  return cache[id]\n}`,
    after: `async function loadUser(id) {\n  const resp = await fetch("/api/users/" + id)\n  cache[id] = await resp.json()\n  return cache[id]\n}`,
    impact: "Eliminates silent data loss on network failures",
  },
  {
    severity: "warning",
    category: "performance",
    title: "O(n\u00B2) Nested Loop",
    file: "utils/filter.ts",
    line: 12,
    explanation: "Array.includes() inside Array.filter() creates O(n*m) complexity. For 10K items with 10K IDs, that is 100M comparisons.",
    before: `const result = items.filter(\n  item => allowedIds.includes(item.id)\n)`,
    after: `const idSet = new Set(allowedIds)\nconst result = items.filter(\n  item => idSet.has(item.id)\n)`,
    impact: "Reduces from O(n\u00B2) to O(n) \u2014 100x faster for large arrays",
  },
  {
    severity: "warning",
    category: "quality",
    title: "Missing Error Boundary",
    file: "components/Dashboard.tsx",
    line: 5,
    explanation: "Component renders user data without error boundary. If any child throws during render, the entire app crashes with a white screen.",
    before: `export default function Dashboard() {\n  return <UserList />\n}`,
    after: `export default function Dashboard() {\n  return (\n    <ErrorBoundary fallback={<ErrorCard />}>\n      <UserList />\n    </ErrorBoundary>\n  )\n}`,
    impact: "Prevents full-app crashes from component errors",
  },
  {
    severity: "info",
    category: "accessibility",
    title: "Image Missing Alt Text",
    file: "pages/about.tsx",
    line: 34,
    explanation: "Screen readers cannot describe this image to visually impaired users. All informational images need descriptive alt text.",
    before: `<img src="/team.jpg" />`,
    after: `<img src="/team.jpg" alt="Team photo of 5 engineers at the office" />`,
    impact: "WCAG 2.1 Level A compliance",
  },
  {
    severity: "info",
    category: "seo",
    title: "Missing Meta Description",
    file: "app/layout.tsx",
    line: 8,
    explanation: "Pages without meta descriptions show auto-generated snippets in search results, reducing click-through rates by up to 30%.",
    before: `export const metadata = {\n  title: "My App"\n}`,
    after: `export const metadata = {\n  title: "My App",\n  description: "Build faster with AI-powered tools"\n}`,
    impact: "Improves search engine click-through rate",
  },
];

const SEV_STYLE = {
  critical: { icon: AlertCircle, color: "text-rose", bg: "bg-rose/10", border: "border-rose/25" },
  warning: { icon: AlertTriangle, color: "text-amber", bg: "bg-amber/10", border: "border-amber/25" },
  info: { icon: Info, color: "text-azure", bg: "bg-azure/10", border: "border-azure/25" },
};

// ── Walkthrough "Video" component ────────────────────────────────────────────
function WalkthroughVideo() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % WALKTHROUGH_SLIDES.length);
    }, 6000);
  }, []);

  useEffect(() => {
    if (playing) {
      startTimer();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, startTimer]);

  const goTo = (i: number) => {
    setCurrent(i);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playing) startTimer();
  };

  const slide = WALKTHROUGH_SLIDES[current];
  const accentMap: Record<string, string> = {
    azure: "bg-azure",
    violet: "bg-violet",
    emerald: "bg-emerald",
    amber: "bg-amber",
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/30">
      {/* Video top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface/60 border-b border-border">
        <div className="w-3 h-3 rounded-full bg-rose/50" />
        <div className="w-3 h-3 rounded-full bg-amber/50" />
        <div className="w-3 h-3 rounded-full bg-emerald/50" />
        <span className="ml-3 text-xs text-dim font-mono">How to use CodeAgent</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => goTo((current - 1 + WALKTHROUGH_SLIDES.length) % WALKTHROUGH_SLIDES.length)}
            className="p-1 rounded hover:bg-muted text-dim hover:text-ghost transition-colors"
            aria-label="Previous step"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="p-1 rounded hover:bg-muted text-dim hover:text-ghost transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => goTo((current + 1) % WALKTHROUGH_SLIDES.length)}
            className="p-1 rounded hover:bg-muted text-dim hover:text-ghost transition-colors"
            aria-label="Next step"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="p-8 min-h-[260px] flex flex-col justify-center">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl ${accentMap[slide.accent] || "bg-azure"} flex items-center justify-center text-white font-display font-800 text-lg`}>
              {slide.step}
            </div>
            <h3 className="font-display text-xl font-700 text-text">{slide.title}</h3>
          </div>
          <p className="text-sm text-ghost leading-relaxed mb-4 max-w-xl">{slide.desc}</p>
          <p className="text-xs text-dim leading-relaxed max-w-xl">{slide.detail}</p>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 px-4 pb-3">
        {WALKTHROUGH_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="flex-1 h-1 rounded-full overflow-hidden bg-muted"
            aria-label={`Go to step ${i + 1}`}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                i < current ? "bg-azure w-full" :
                i === current ? "bg-azure" : "w-0"
              }`}
              style={i === current ? {
                width: playing ? "100%" : "30%",
                transition: playing ? "width 6s linear" : "width 0.3s",
              } : undefined}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main landing page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleLaunch = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem("ca_api_key", apiKey.trim());
      sessionStorage.setItem("ca_provider", "openrouter");
    }
    router.push("/review");
  };

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-azure/4 blur-[140px]" />
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet/4 blur-[140px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto" aria-label="Site navigation">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-lg bg-azure flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-700 text-lg text-text tracking-tight">CodeAgent</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center gap-3"
        >
          <a
            href="https://github.com/foraiusea-rgb/CodeAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-ghost hover:text-soft transition-colors duration-150 px-3 py-2 min-h-[44px]"
            aria-label="View source on GitHub"
          >
            <GitBranch className="w-3.5 h-3.5" />
            GitHub
          </a>
          <button
            onClick={() => router.push("/review")}
            className="flex items-center gap-2 text-sm font-medium bg-surface border border-border hover:border-azure/40 text-text px-4 py-2.5 rounded-lg transition-colors duration-150 hover:bg-card min-h-[44px]"
          >
            Open App <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="font-display text-5xl md:text-6xl font-800 leading-[1] tracking-tight mb-6 text-text">
            Code reviews that<br />
            <span className="text-azure">actually fix things</span>
          </h1>

          <p className="text-lg text-ghost max-w-xl mx-auto leading-relaxed mb-4">
            Manual code reviews miss bugs, take hours, and rarely produce actionable fixes.
            CodeAgent scans your code with AI and generates one-click patches you can apply instantly.
          </p>

          <div className="flex items-center justify-center gap-4 text-xs text-dim mb-10">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 30 seconds per file</span>
            <span className="w-1 h-1 rounded-full bg-dim" />
            <span>Works with 20+ LLMs</span>
            <span className="w-1 h-1 rounded-full bg-dim" />
            <span>No account needed</span>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {!showInput ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push("/review")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-600 text-white bg-azure text-sm hover:bg-azure/90 transition-colors duration-150 min-h-[48px]"
                >
                  <Zap className="w-4 h-4" />
                  Start analyzing code
                </motion.button>
                <button
                  onClick={() => setShowInput(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-ghost hover:text-soft border border-border hover:border-muted transition-colors duration-150 min-h-[48px]"
                >
                  I have an API key <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 bg-card border border-border rounded-xl p-1.5 w-full max-w-md"
              >
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLaunch()}
                  placeholder="sk-or-v1-... or your Gemini key"
                  autoFocus
                  aria-label="Enter your API key"
                  className="flex-1 bg-transparent text-sm text-text placeholder:text-dim px-3 outline-none font-mono min-h-[40px]"
                />
                <button
                  onClick={handleLaunch}
                  className="flex items-center gap-1.5 bg-azure text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap hover:bg-azure/90 transition-colors duration-150 min-h-[40px]"
                >
                  Launch <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </div>

          <p className="mt-4 text-xs text-dim">
            Free with OpenRouter &middot; Keys stored in-browser only &middot; Self-hostable &middot; MIT License
          </p>
        </motion.div>

        {/* Code preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 px-4 py-3 bg-surface/60 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-rose/50" aria-hidden="true" />
              <div className="w-3 h-3 rounded-full bg-amber/50" aria-hidden="true" />
              <div className="w-3 h-3 rounded-full bg-emerald/50" aria-hidden="true" />
              <span className="ml-3 text-xs text-dim font-mono">user-service.ts</span>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald bg-emerald/8 border border-emerald/15 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                2 fixes applied
              </div>
            </div>
            <pre className="p-5 text-xs font-mono leading-relaxed overflow-x-auto text-soft" aria-label="Code sample showing before and after CodeAgent">
              <code>{CODE_SAMPLE}</code>
            </pre>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-24 max-w-3xl mx-auto"
        >
          <h2 className="font-display text-2xl font-700 text-text text-center mb-10">How it works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mx-auto mb-3 relative">
                  <step.icon className="w-5 h-5 text-azure" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-azure text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                </div>
                <div className="font-display font-600 text-sm text-text mb-1">{step.label}</div>
                <div className="text-xs text-ghost">{step.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Video Walkthrough */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-24 max-w-3xl mx-auto"
        >
          <h2 className="font-display text-2xl font-700 text-text text-center mb-3">Step-by-step walkthrough</h2>
          <p className="text-ghost text-sm text-center mb-8">Watch how a full analysis works from start to finish</p>
          <WalkthroughVideo />
        </motion.div>

        {/* What it catches */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.06 }}
              className="rounded-xl p-5 bg-card border border-border group hover:border-muted transition-colors duration-200 cursor-default"
            >
              <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center mb-3 group-hover:border-muted transition-colors duration-200">
                <f.icon className={`w-4 h-4 ${f.accent}`} />
              </div>
              <div className="font-display font-600 text-sm text-text mb-1">{f.label}</div>
              <div className="text-xs text-ghost leading-relaxed">{f.desc}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Real Example Findings */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-24 max-w-5xl mx-auto"
        >
          <h2 className="font-display text-2xl font-700 text-text text-center mb-3">Real findings, real fixes</h2>
          <p className="text-ghost text-sm text-center mb-10 max-w-xl mx-auto">
            These are actual examples of what CodeAgent catches. Each finding includes an explanation, the exact code to fix, and a one-click patch.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXAMPLE_FINDINGS.map((ex, i) => {
              const sev = SEV_STYLE[ex.severity as keyof typeof SEV_STYLE];
              const SevIcon = sev.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.05 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Finding header */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${sev.bg} ${sev.color} ${sev.border} border`}>
                        <SevIcon className="w-3 h-3" />
                        {ex.severity}
                      </span>
                      <span className="text-[10px] text-dim bg-muted/40 px-1.5 py-0.5 rounded-md">{ex.category}</span>
                      <span className="text-[10px] text-dim font-mono ml-auto">{ex.file}:{ex.line}</span>
                    </div>
                    <p className="text-sm font-600 text-text">{ex.title}</p>
                    <p className="text-xs text-ghost leading-relaxed">{ex.explanation}</p>
                    {ex.impact && (
                      <p className="text-[11px] text-emerald">&uarr; {ex.impact}</p>
                    )}
                  </div>
                  {/* Before / After */}
                  <div className="border-t border-border">
                    <pre className="text-[10px] font-mono px-4 py-2.5 bg-rose/3 text-rose/80 leading-relaxed overflow-x-auto border-b border-border">
                      <code>{ex.before}</code>
                    </pre>
                    <pre className="text-[10px] font-mono px-4 py-2.5 bg-emerald/3 text-emerald/80 leading-relaxed overflow-x-auto">
                      <code>{ex.after}</code>
                    </pre>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-24 text-center"
        >
          <button
            onClick={() => router.push("/review")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-600 text-sm text-white bg-azure hover:bg-azure/90 transition-colors duration-150 min-h-[48px]"
          >
            Start analyzing code <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-4 text-xs text-dim">No account needed &middot; Self-hostable &middot; MIT License</p>
        </motion.div>
      </main>
    </div>
  );
}
