import { useStore, type AgentMode, type Finding, type CodeFile } from "./store";

const SYSTEM_REVIEW = `You are an expert code reviewer. Analyze the provided codebase and return a JSON array of findings.

Each finding must have these exact fields:
{
  "id": "unique string",
  "file": "filename",
  "line_start": number or null,
  "line_end": number or null,
  "severity": "critical" | "warning" | "info",
  "category": "bugs" | "security" | "performance" | "quality" | "accessibility" | "seo",
  "title": "short title",
  "explanation": "clear explanation of the issue",
  "old_code": "exact code snippet to replace (copy verbatim)",
  "new_code": "improved replacement code",
  "impact": "brief impact statement"
}

Return ONLY a valid JSON array. No markdown, no commentary. Focus on actionable, high-value findings.`;

const SYSTEM_OPTIMIZE = `You are an expert code optimizer. Analyze the provided codebase for optimization opportunities and return a JSON array.

Each item must have:
{
  "id": "unique string",
  "file": "filename",
  "line_start": number or null,
  "severity": "critical" | "warning" | "info",
  "category": "performance" | "quality" | "patterns" | "refactor",
  "title": "optimization title",
  "explanation": "why this optimization matters",
  "old_code": "exact current code",
  "new_code": "optimized replacement",
  "impact": "expected improvement"
}

Return ONLY a valid JSON array. No markdown fences.`;

function buildCodebasePrompt(files: Record<string, CodeFile>, config: { aggression: string; focus: string[] }): string {
  const fileEntries = Object.entries(files);
  if (fileEntries.length === 0) return "No files provided.";

  const parts = [`Focus areas: ${config.focus.join(", ")}\nAggression level: ${config.aggression}\n\n`];
  let totalChars = 0;
  const MAX_CHARS = 80000;

  for (const [path, file] of fileEntries) {
    const chunk = `=== FILE: ${path} ===\n${file.content}\n\n`;
    if (totalChars + chunk.length > MAX_CHARS) {
      parts.push(`[${path} truncated — too large]\n\n`);
    } else {
      parts.push(chunk);
      totalChars += chunk.length;
    }
  }

  return parts.join("");
}

function extractJSON(text: string): unknown[] {
  // Try direct parse
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Try to find JSON array in the text
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // Try to extract from markdown code blocks
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
}

async function callAI(userPrompt: string, systemPrompt: string, config: ReturnType<typeof useStore.getState>["config"]): Promise<string> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
      apiKey: config.apiKey,
      provider: config.provider,
      model: config.model,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content || "";
}

export async function runAgent(mode: AgentMode) {
  const store = useStore.getState();
  const { files, config, setAgentRunning, setAgentStatus, setProgress, addFindings, addTimeline, clearFindings } = store;

  if (Object.keys(files).length === 0) {
    throw new Error("No files uploaded. Drop some code files first.");
  }
  if (config.provider !== "local" && !config.apiKey.trim()) {
    throw new Error("No API key. Add one in Config ⚙️");
  }

  setAgentRunning(true, mode);
  clearFindings();
  addTimeline({ message: `Agent started: ${mode} mode`, type: "system" });

  const modes: AgentMode[] = mode === "pipeline" ? ["review", "optimize"] : [mode];
  const totalPasses = modes.length;

  try {
    for (let i = 0; i < modes.length; i++) {
      const currentMode = modes[i];
      const passNum = i + 1;
      setProgress(passNum, totalPasses);
      setAgentStatus(`Pass ${passNum}/${totalPasses}: Running ${currentMode} analysis…`);
      addTimeline({ message: `Pass ${passNum}: ${currentMode}`, type: "system" });

      const system = currentMode === "review" ? SYSTEM_REVIEW : SYSTEM_OPTIMIZE;
      const prompt = buildCodebasePrompt(files, config);

      setAgentStatus(`Calling AI model (${config.model})…`);
      const raw = await callAI(prompt, system, config);

      setAgentStatus("Parsing findings…");
      const parsed = extractJSON(raw);

      const findings: Finding[] = parsed
        .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
        .map((f) => ({
          id: String(f.id || Math.random().toString(36).slice(2)),
          file: String(f.file || "unknown"),
          line_start: typeof f.line_start === "number" ? f.line_start : undefined,
          line_end: typeof f.line_end === "number" ? f.line_end : undefined,
          severity: (["critical", "warning", "info"].includes(String(f.severity)) ? f.severity : "info") as Finding["severity"],
          category: String(f.category || "quality"),
          title: String(f.title || "Untitled"),
          explanation: String(f.explanation || ""),
          old_code: f.old_code ? String(f.old_code) : undefined,
          new_code: f.new_code ? String(f.new_code) : undefined,
          impact: f.impact ? String(f.impact) : undefined,
          status: "pending",
          pass: passNum,
          mode: currentMode,
          timestamp: new Date().toISOString(),
        }));

      if (config.autoApproveInfo) {
        findings.forEach((f) => { if (f.severity === "info") f.status = "approved"; });
      }

      addFindings(findings);
      addTimeline({ message: `Found ${findings.length} issues`, type: "system" });
      setAgentStatus(`Pass ${passNum} complete — ${findings.length} findings`);
    }

    setAgentStatus("Analysis complete");
    addTimeline({ message: "Agent finished successfully", type: "system" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setAgentStatus(`Error: ${msg}`);
    addTimeline({ message: `Error: ${msg}`, type: "error" });
    throw err;
  } finally {
    setAgentRunning(false, null);
  }
}
