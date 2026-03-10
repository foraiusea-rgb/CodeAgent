// ── Gemini Embedding 2 — Client-side embedding & search ──────────────────────
// Chunks files, calls /api/embeddings, computes cosine similarity client-side.
// No database needed — embeddings stored in Zustand store.

import type { CodeFile, EmbeddedChunk, SearchResult } from "./store";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  preview: string;
}

// ── Chunking ─────────────────────────────────────────────────────────────────

/** Split a single file into chunks of ~chunkSize lines with overlap. */
export function chunkFile(
  filePath: string,
  content: string,
  chunkSize = 500,
  overlap = 50
): CodeChunk[] {
  const lines = content.split("\n");

  // Small files stay as a single chunk
  if (lines.length <= chunkSize) {
    return [
      {
        id: `${filePath}:1-${lines.length}`,
        filePath,
        startLine: 1,
        endLine: lines.length,
        content,
        preview: lines.slice(0, 4).join("\n"),
      },
    ];
  }

  const chunks: CodeChunk[] = [];
  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + chunkSize, lines.length);
    const chunkLines = lines.slice(start, end);
    chunks.push({
      id: `${filePath}:${start + 1}-${end}`,
      filePath,
      startLine: start + 1,
      endLine: end,
      content: chunkLines.join("\n"),
      preview: chunkLines.slice(0, 4).join("\n"),
    });
    if (end >= lines.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}

/** Chunk all files in the store. */
export function chunkAllFiles(files: Record<string, CodeFile>): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  for (const file of Object.values(files)) {
    chunks.push(...chunkFile(file.path, file.content));
  }
  return chunks;
}

// ── Embedding API calls ──────────────────────────────────────────────────────

const BATCH_SIZE = 50;

/** Embed an array of code chunks via /api/embeddings. Returns EmbeddedChunks. */
export async function embedChunks(
  chunks: CodeChunk[],
  apiKey: string,
  onProgress?: (done: number, total: number) => void
): Promise<EmbeddedChunk[]> {
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const resp = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: batch.map((c) => c.content),
        apiKey,
        taskType: "RETRIEVAL_DOCUMENT",
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `Embedding failed: ${resp.status}`);
    }

    const data = await resp.json();

    for (let j = 0; j < batch.length; j++) {
      const embedding = data.embeddings[j];
      // Pre-compute magnitude for fast cosine similarity
      let mag = 0;
      for (let k = 0; k < embedding.length; k++) mag += embedding[k] * embedding[k];
      mag = Math.sqrt(mag);

      results.push({
        ...batch[j],
        embedding,
        magnitude: mag,
      });
    }

    onProgress?.(Math.min(i + BATCH_SIZE, chunks.length), chunks.length);
  }

  return results;
}

/** Embed a single search query. Uses CODE_RETRIEVAL_QUERY task type. */
export async function embedQuery(
  query: string,
  apiKey: string
): Promise<number[]> {
  const resp = await fetch("/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texts: [query],
      apiKey,
      taskType: "CODE_RETRIEVAL_QUERY",
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `Query embedding failed: ${resp.status}`);
  }

  const data = await resp.json();
  return data.embeddings[0];
}

// ── Similarity math ──────────────────────────────────────────────────────────

/** Cosine similarity between two vectors. Returns 0-1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/** Fast cosine similarity using pre-computed magnitude. */
function fastCosineSimilarity(
  a: number[],
  b: number[],
  magB: number
): number {
  let dotProduct = 0;
  let normA = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
  }
  const denominator = Math.sqrt(normA) * magB;
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Search stored chunks by a query embedding. Returns ranked results. */
export function searchEmbeddings(
  queryEmbedding: number[],
  storedChunks: EmbeddedChunk[],
  topK = 20,
  threshold = 0.3
): SearchResult[] {
  const scored: { chunk: EmbeddedChunk; score: number }[] = [];

  for (const chunk of storedChunks) {
    const score = fastCosineSimilarity(queryEmbedding, chunk.embedding, chunk.magnitude);
    if (score >= threshold) {
      scored.push({ chunk, score });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Return top K without embedding data (save memory in search results)
  return scored.slice(0, topK).map(({ chunk, score }) => ({
    chunk: {
      id: chunk.id,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content,
      preview: chunk.preview,
    },
    score,
  }));
}

/** Find code similar to a given chunk. Excludes the source chunk itself. */
export function findSimilarCode(
  sourceChunk: EmbeddedChunk,
  allChunks: EmbeddedChunk[],
  topK = 10,
  threshold = 0.5
): SearchResult[] {
  const scored: { chunk: EmbeddedChunk; score: number }[] = [];

  for (const chunk of allChunks) {
    if (chunk.id === sourceChunk.id) continue;
    const score = fastCosineSimilarity(
      sourceChunk.embedding,
      chunk.embedding,
      chunk.magnitude
    );
    if (score >= threshold) {
      scored.push({ chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({ chunk, score }) => ({
    chunk: {
      id: chunk.id,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content,
      preview: chunk.preview,
    },
    score,
  }));
}
