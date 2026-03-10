import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, system, apiKey, provider, model } = await req.json();

    let content = "";
    if (provider === "local") {
      content = await callLocal(messages, system, model);
    } else if (provider === "gemini") {
      if (!apiKey?.trim()) {
        return NextResponse.json({ error: "No API key provided" }, { status: 400 });
      }
      content = await callGemini(messages, system, apiKey, model);
    } else {
      if (!apiKey?.trim()) {
        return NextResponse.json({ error: "No API key provided" }, { status: 400 });
      }
      content = await callOpenRouter(messages, system, apiKey, model);
    }

    return NextResponse.json({ content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function callLocal(
  messages: { role: string; content: string }[],
  system: string,
  model: string
): Promise<string> {
  const baseUrl = "http://localhost:1234";
  const allMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  try {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "default",
        max_tokens: 4096,
        temperature: 0.2,
        messages: allMessages,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Local LLM ${resp.status}: ${text.slice(0, 300)}`);
    }

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("ECONNREFUSED"))) {
      throw new Error(
        "Cannot connect to LM Studio. Make sure it is running and the local server is started on port 1234. " +
        "In LM Studio: load a model then click Start Server (Developer tab)."
      );
    }
    throw err;
  }
}

async function callOpenRouter(
  messages: { role: string; content: string }[],
  system: string,
  apiKey: string,
  model: string
): Promise<string> {
  const allMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://codeagent.vercel.app",
        "X-Title": "CodeAgent",
      },
      body: JSON.stringify({
        model: model || "deepseek/deepseek-r1-0528:free",
        max_tokens: 8000,
        temperature: 0.2,
        messages: allMessages,
      }),
    });

    if (resp.status === 429) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 10000));
      continue;
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenRouter ${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices?.[0]?.message?.content ?? "";
  }
  throw new Error("Rate limited after retries. Please wait.");
}

async function callGemini(
  messages: { role: string; content: string }[],
  system: string,
  apiKey: string,
  model: string
): Promise<string> {
  const geminiModel = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const contents = [];
  if (system) {
    contents.push({ role: "user", parts: [{ text: "INSTRUCTIONS:\n" + system }] });
    contents.push({ role: "model", parts: [{ text: "Understood. Returning only valid JSON." }] });
  }
  for (const m of messages) {
    contents.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });
    if (resp.status === 429) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 20000));
      continue;
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = await resp.json();
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts?.length) throw new Error("Gemini returned empty response");
    return parts[0].text ?? "";
  }
  throw new Error("Gemini rate limited. Try gemini-1.5-pro or OpenRouter.");
}
