import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// ── Gemini Embedding API proxy ───────────────────────────────────────────────
// Follows the same pattern as /api/analyze — receives API key in body,
// calls Gemini's batchEmbedContents, returns embeddings.

export async function POST(req: NextRequest) {
  try {
    const { texts, apiKey, taskType, model } = await req.json();

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "No API key provided. Add your Gemini key in Config." }, { status: 400 });
    }
    if (!texts?.length) {
      return NextResponse.json({ error: "No texts provided" }, { status: 400 });
    }
    if (texts.length > 200) {
      return NextResponse.json({ error: "Too many texts (max 200 per request)" }, { status: 400 });
    }

    const embeddingModel = model || "text-embedding-004";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:batchEmbedContents?key=${apiKey}`;

    const requests = texts.map((text: string) => ({
      model: `models/${embeddingModel}`,
      content: { parts: [{ text }] },
      taskType: taskType || "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    }));

    // Batch in groups of 50 to stay within API limits
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < requests.length; i += 50) {
      const batch = requests.slice(i, i + 50);

      let resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: batch }),
        signal: AbortSignal.timeout(25000),
      });

      // Retry on rate limit (429) with backoff
      if (resp.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests: batch }),
          signal: AbortSignal.timeout(25000),
        });
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "Unknown error");
        if (resp.status === 404) {
          return NextResponse.json(
            { error: `Embedding model "${embeddingModel}" not found. Check your API key supports the Gemini Embedding API.` },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: `Gemini Embedding ${resp.status}: ${errText.slice(0, 300)}` },
          { status: resp.status }
        );
      }

      const data = await resp.json();

      if (!data.embeddings?.length) {
        return NextResponse.json(
          { error: "Gemini returned empty embeddings response" },
          { status: 500 }
        );
      }

      for (const emb of data.embeddings) {
        allEmbeddings.push(emb.values);
      }
    }

    return NextResponse.json({ embeddings: allEmbeddings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("AbortError") || msg.includes("timeout")) {
      return NextResponse.json({ error: "Embedding request timed out. Try with fewer files." }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
