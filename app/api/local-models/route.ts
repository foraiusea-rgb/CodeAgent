import { NextResponse } from "next/server";

export async function GET() {
  try {
    const resp = await fetch("http://localhost:1234/v1/models", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) {
      return NextResponse.json({
        status: "error",
        models: [],
        message: "LM Studio server responded with an error. Make sure a model is loaded.",
      });
    }

    const data = await resp.json();
    const models = (data.data || []).map((m: { id: string; object?: string; owned_by?: string }) => ({
      id: m.id,
      object: m.object || "model",
      owned_by: m.owned_by || "local",
    }));

    return NextResponse.json({
      status: "connected",
      models,
      message: `Found ${models.length} model(s) loaded in LM Studio`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("timeout") || msg.includes("abort");
    const isConnRefused = msg.includes("ECONNREFUSED") || msg.includes("fetch");

    return NextResponse.json({
      status: "offline",
      models: [],
      message: isTimeout || isConnRefused
        ? "LM Studio is not running or the server is not started. Open LM Studio, load a model, and start the server (port 1234)."
        : `Connection error: ${msg}`,
    });
  }
}
