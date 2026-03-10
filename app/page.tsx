"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, Shield, Rocket, GitBranch, ArrowRight, Sparkles, CheckCircle, Search, Layers } from "lucide-react";

const FEATURES = [
  { icon: Shield, label: "Bug Detection", desc: "Catch logic errors, null refs, and edge cases before they hit production", accent: "text-rose" },
  { icon: Zap, label: "Performance", desc: "Identify bottlenecks, O(n²) loops, and unnecessary re-renders instantly", accent: "text-amber" },
  { icon: Rocket, label: "Optimization", desc: "Refactor to idiomatic patterns, reduce complexity, improve readability", accent: "text-emerald" },
  { icon: GitBranch, label: "Security", desc: "Spot injection vulnerabilities, insecure deps, and auth flaws", accent: "text-violet" },
];

const MODES = [
  { icon: Search, name: "Review", desc: "Bugs, security issues, code smells", accent: "azure", bg: "bg-azure/8", border: "border-azure/15" },
  { icon: Rocket, name: "Optimize", desc: "Performance, patterns, readability", accent: "violet", bg: "bg-violet/8", border: "border-violet/15" },
  { icon: Layers, name: "Pipeline", desc: "Full review + optimize in one pass", accent: "emerald", bg: "bg-emerald/8", border: "border-emerald/15" },
];

const MODELS = [
  "DeepSeek R1", "Claude Sonnet", "GPT-4o", "Gemini 2.5 Pro",
  "Llama 4", "Qwen3 235B", "Mistral", "Phi-4"
];

const CODE_SAMPLE = `// Before CodeAgent
function getUserData(id) {
  const user = db.query("SELECT * FROM users WHERE id = " + id)
  return user.data
}

// After CodeAgent
async function getUserData(id: string): Promise<User> {
  // ✓ Parameterized query (SQL injection fix)
  // ✓ Added type safety
  // ✓ Async/await pattern
  const user = await db.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  )
  return user.rows[0] ?? null
}`;

export default function LandingPage() {
  const router = useRouter();
  const [modelIdx, setModelIdx] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setModelIdx(i => (i + 1) % MODELS.length), 2000);
    return () => clearInterval(t);
  }, []);

  const handleLaunch = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem("ca_api_key", apiKey.trim());
      sessionStorage.setItem("ca_provider", "openrouter");
    }
    router.push("/review");
  };

  return (
    <div className="min-h-screen bg-void relative overflow-x-hidden">
      {/* Ambient background — subtle, not neon */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-azure/4 blur-[140px]" />
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet/4 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
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
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-card border border-border text-ghost text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3 h-3 text-azure" />
            Powered by{" "}
            <motion.span
              key={modelIdx}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25 }}
              className="font-mono text-text"
            >
              {MODELS[modelIdx]}
            </motion.span>
            <span className="text-dim">& more</span>
          </div>

          {/* Headline — solid text, no gradient */}
          <h1 className="font-display text-6xl md:text-7xl font-800 leading-[0.95] tracking-tight mb-6">
            <span className="text-text">Code review</span>
            <br />
            <span className="text-azure">reimagined</span>
          </h1>

          <p className="text-lg text-ghost max-w-xl mx-auto leading-relaxed mb-10">
            Upload your codebase. Get structured AI findings. Apply fixes with one click.
            Works with OpenRouter, Gemini, or your own local LLM via LM Studio.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {!showInput ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowInput(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-600 text-white bg-azure text-sm hover:bg-azure/90 transition-colors duration-150 min-h-[48px]"
                >
                  <Zap className="w-4 h-4" />
                  Start with API Key
                </motion.button>
                <button
                  onClick={() => router.push("/review")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-ghost hover:text-soft border border-border hover:border-muted transition-colors duration-150 min-h-[48px]"
                >
                  Try without key <ArrowRight className="w-3.5 h-3.5" />
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
            Keys stored in session only · Never sent to our servers · OpenRouter free tier works
          </p>
        </motion.div>

        {/* Code preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="rounded-2xl overflow-hidden border border-border bg-card/80 shadow-2xl shadow-black/40">
            {/* Window chrome */}
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

        {/* Features — varied accent colors per feature, no glass */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              className="rounded-xl p-5 bg-card border border-border group hover:border-muted transition-colors duration-200 cursor-default"
            >
              <div className={`w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center mb-3 group-hover:border-muted transition-colors duration-200`}>
                <f.icon className={`w-4 h-4 ${f.accent}`} />
              </div>
              <div className="font-display font-600 text-sm text-text mb-1">{f.label}</div>
              <div className="text-xs text-ghost leading-relaxed">{f.desc}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Three modes — SVG icons instead of emoji */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-24 text-center max-w-3xl mx-auto"
        >
          <h2 className="font-display text-3xl font-700 text-text mb-3">Three modes. One workflow.</h2>
          <p className="text-ghost text-sm mb-10">Pick the depth you need — from a quick review to a full refactor pipeline.</p>

          <div className="grid grid-cols-3 gap-4">
            {MODES.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 + i * 0.06 }}
                className={`rounded-xl p-5 text-center group cursor-default border ${m.border} ${m.bg} hover:border-muted transition-colors duration-200`}
              >
                <div className={`w-10 h-10 rounded-xl border ${m.border} ${m.bg} flex items-center justify-center mx-auto mb-3`}>
                  <m.icon className={`w-5 h-5 text-${m.accent}`} />
                </div>
                <div className="font-display font-700 text-sm text-text mb-1">{m.name}</div>
                <div className="text-xs text-ghost">{m.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-24 text-center"
        >
          <button
            onClick={() => router.push("/review")}
            className="inline-flex items-center gap-2 font-display font-600 text-sm text-ghost hover:text-soft transition-colors duration-150 min-h-[44px]"
          >
            Open workspace <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-3 text-xs text-dim">No account needed · Self-hostable · MIT License</p>
        </motion.div>
      </main>
    </div>
  );
}
