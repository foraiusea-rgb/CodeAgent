import { useStore, type Finding, type CodeFile, type TokenUsage } from "./store";
import { callLLM } from "./llm-client";

function buildSystemPrompt(focus: string[]): string {
  const focusStr = focus.length > 0 ? focus.join(", ") : "bugs, security, performance, quality";

  return `You are an expert code analyst. Analyze the provided codebase and return a JSON array of findings.

Focus on these areas: ${focusStr}

Each finding must have these exact fields:
{
  "id": "unique string",
  "file": "filename",
  "line_start": number or null,
  "line_end": number or null,
  "severity": "critical" | "warning" | "info",
  "category": "${focus.join('" | "') || "bugs\" | \"security\" | \"performance\" | \"quality"}",
  "title": "short title",
  "explanation": "clear explanation of the issue and why it matters",
  "old_code": "exact code snippet to replace (copy verbatim from the source)",
  "new_code": "improved replacement code",
  "impact": "brief impact statement"
}

Rules:
- Return ONLY a valid JSON array. No markdown, no commentary, no code fences.
- Focus on actionable, high-value findings with concrete fixes.
- old_code must be an exact copy from the source so it can be matched and replaced.
- Cover edge cases: null checks, off-by-one errors, race conditions, missing error handling.
- For security: check for injection, XSS, hardcoded secrets, insecure patterns.
- For performance: flag O(n\u00B2) loops, unnecessary re-renders, missing memoization, N+1 queries.`;
}

function buildDeepPassPrompt(focus: string[]): string {
  const focusStr = focus.length > 0 ? focus.join(", ") : "bugs, security, performance, quality";

  return `You are an expert code analyst performing a DEEP second pass. The first pass already found obvious issues.
Now look for SUBTLE problems that are easy to miss.

Focus on these areas: ${focusStr}

Look specifically for:
- Edge cases: What happens with empty arrays, null values, concurrent access, very large inputs?
- Security: Are there timing attacks, CSRF vulnerabilities, information leakage in error messages?
- Architectural: Is there tight coupling, missing abstraction, violation of SOLID principles?
- Hidden bugs: Race conditions, memory leaks, unclosed resources, implicit type coercion?
- Missing validation: Boundary checks, type guards, input sanitization?

Each finding must have these exact fields:
{
  "id": "unique string",
  "file": "filename",
  "line_start": number or null,
  "line_end": number or null,
  "severity": "critical" | "warning" | "info",
  "category": "${focusStr}",
  "title": "short title",
  "explanation": "clear explanation of the subtle issue",
  "old_code": "exact code snippet to replace (copy verbatim)",
  "new_code": "improved replacement code",
  "impact": "what could go wrong if this is not fixed"
}

Return ONLY a valid JSON array. No markdown, no commentary.`;
}

function buildCodebasePrompt(files: Record<string, CodeFile>, config: { focus: string[]; provider?: string }): string {
  const fileEntries = Object.entries(files);
  if (fileEntries.length === 0) return "No files provided.";

  const parts = ["Focus areas: " + config.focus.join(", ") + "\n\n"];
  let totalChars = 0;
  const MAX_CHARS = config.provider === "local" ? 20000 : 80000;

  for (const [path, file] of fileEntries) {
    const header = "=== FILE: " + path + " ===\n";
    const chunk = header + file.content + "\n\n";
    if (totalChars + chunk.length > MAX_CHARS) {
      const remaining = MAX_CHARS - totalChars;
      if (remaining > 300) {
        const truncContent = file.content.slice(0, remaining - 100);
        parts.push(header + truncContent + "\n[... rest truncated to fit context]\n\n");
        totalChars = MAX_CHARS;
      } else {
        parts.push("[" + path + " skipped]\n\n");
      }
    } else {
      parts.push(chunk);
      totalChars += chunk.length;
    }
  }

  return parts.join("");
}


function extractJSON(text: string): unknown[] {
  // Pre-clean: strip reasoning/thinking tags (Qwen, DeepSeek, etc.)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object" && parsed !== null) return [parsed];
  } catch {}

  // Strategy 2: Extract from markdown code fences first (more specific)
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    try {
      const parsed = JSON.parse(inner);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "object" && parsed !== null) return [parsed];
    } catch {}
    // Try with trailing comma repair
    const repaired = repairJSON(inner);
    try {
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // Strategy 3: Find JSON array in the text (greedy)
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    // Try with trailing comma repair
    const repaired = repairJSON(match[0]);
    try {
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // Strategy 4: Find individual JSON objects and collect them
  const objects: unknown[] = [];
  const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let objMatch;
  while ((objMatch = objRegex.exec(cleaned)) !== null) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed && typeof parsed === "object" && ("title" in parsed || "severity" in parsed || "explanation" in parsed)) {
        objects.push(parsed);
      }
    } catch {}
  }
  if (objects.length > 0) return objects;

  return [];
}

/** Fix common JSON issues from LLMs: trailing commas, single quotes, etc. */
function repairJSON(text: string): string {
  let s = text;
  // Remove trailing commas before ] or }
  s = s.replace(/,\s*([}\]])/g, "$1");
  // Replace single quotes with double quotes (crude but helps)
  // Only if there are no double quotes already (avoids breaking valid JSON)
  if (!s.includes('"') && s.includes("'")) {
    s = s.replace(/'/g, '"');
  }
  return s;
}

async function callAI(
  userPrompt: string,
  systemPrompt: string,
  config: ReturnType<typeof useStore.getState>["config"]
): Promise<{ content: string; usage: TokenUsage }> {
  const result = await callLLM(
    [{ role: "user", content: userPrompt }],
    systemPrompt,
    config.apiKey,
    config.provider,
    config.model
  );

  return {
    content: result.content || "",
    usage: {
      promptTokens: result.usage.prompt_tokens,
      completionTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
    },
  };
}

export async function runAgent() {
  const store = useStore.getState();
  const {
    files, config, setAgentRunning, setAgentStatus, setProgress,
    addFindings, addTimeline, clearFindings,
    resetTokenUsage, addTokenUsage, setAgentStep, setElapsedTime,
  } = store;

  if (Object.keys(files).length === 0) {
    throw new Error("No files uploaded. Drop some code files first.");
  }
  if (config.provider !== "local" && !config.apiKey.trim()) {
    throw new Error("No API key. Add one in Config.");
  }

  setAgentRunning(true);
  clearFindings();
  resetTokenUsage();
  setElapsedTime(0);
  setAgentStep("initializing", 0);

  const isDeep = config.scanDepth === "deep";
  const totalPasses = isDeep ? 2 : 1;
  const startTime = Date.now();

  addTimeline({ message: `Analysis started (${isDeep ? "deep" : "quick"} scan)`, type: "system" });

  // Elapsed time tracker
  const timerInterval = setInterval(() => {
    useStore.getState().setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
  }, 1000);

  try {
    for (let passNum = 1; passNum <= totalPasses; passNum++) {
      setProgress(passNum, totalPasses);

      // Sub-step 1: Building prompt
      setAgentStep("Building code prompt...", 10);
      const passLabel = isDeep ? `Pass ${passNum}/${totalPasses}` : "Analyzing";
      setAgentStatus(`${passLabel}: Preparing analysis...`);
      if (isDeep) {
        addTimeline({ message: `Pass ${passNum}: ${passNum === 1 ? "primary scan" : "deep edge-case scan"}`, type: "system" });
      }

      const system = passNum === 1
        ? buildSystemPrompt(config.focus)
        : buildDeepPassPrompt(config.focus);
      const prompt = buildCodebasePrompt(files, { ...config, provider: config.provider });

      // Sub-step 2: Calling AI
      setAgentStep("Sending to AI model...", 30);
      setAgentStatus(`${passLabel}: Calling ${config.model || "AI"}...`);

      const result = await callAI(prompt, system, config);

      // Sub-step 3: Token usage received
      addTokenUsage(result.usage);
      setAgentStep("Parsing response...", 75);
      setAgentStatus(`${passLabel}: Parsing findings...`);

      // Sub-step 4: Parse findings
      const parsed = extractJSON(result.content);

      if (parsed.length === 0 && result.content.length > 0) {
        // Model returned content but we couldn't parse it — log for debugging
        const snippet = result.content.slice(0, 200).replace(/\n/g, " ");
        addTimeline({
          message: `Pass ${passNum}: Model returned ${result.usage.completionTokens} tokens but no valid JSON was found. Response starts with: "${snippet}..."`,
          type: "error",
        });
      }

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
          timestamp: new Date().toISOString(),
        }));

      if (config.autoApproveInfo) {
        findings.forEach((f) => { if (f.severity === "info") f.status = "approved"; });
      }

      // Sub-step 5: Adding findings
      setAgentStep("Adding findings...", 90);
      addFindings(findings);
      addTimeline({ message: `Found ${findings.length} issues`, type: "system" });

      setAgentStep("Pass complete", 100);
      setAgentStatus(`${passLabel} complete — ${findings.length} findings`);
    }

    const totalFindings = Object.keys(useStore.getState().findings).length;
    setAgentStep("Analysis complete", 100);
    if (totalFindings === 0) {
      setAgentStatus("Analysis complete — no findings parsed. Try a different model.");
      addTimeline({ message: "Analysis finished but 0 findings were parsed. The model may not support structured JSON output. Try Qwen3 Coder, Gemma 3, or Gemini.", type: "error" });
    } else {
      setAgentStatus(`Analysis complete — ${totalFindings} findings`);
      addTimeline({ message: "Analysis finished successfully", type: "system" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setAgentStep("Error", 0);
    setAgentStatus(`Error: ${msg}`);
    addTimeline({ message: `Error: ${msg}`, type: "error" });
    throw err;
  } finally {
    clearInterval(timerInterval);
    setAgentRunning(false);
  }
}
