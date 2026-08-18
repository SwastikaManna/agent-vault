import { getStore, storeMode } from "@/lib/memory-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const store = getStore();
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  const wantStats = url.searchParams.get("stats") === "1";

  try {
    if (wantStats) {
      return Response.json({ mode: storeMode(), stats: await store.stats() });
    }
    if (path) {
      const content = await store.read(path);
      if (content === null) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ path, content, mode: storeMode() });
    }
    return Response.json({ nodes: await store.list(), mode: storeMode() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const store = getStore();
  let body: { path?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = body.path?.trim();
  const content = body.content;
  if (!p || !p.endsWith(".md") || p.includes("..")) {
    return Response.json({ error: "Invalid note path (must end in .md)" }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return Response.json({ error: "Empty note content" }, { status: 400 });
  }
  try {
    await store.write(p, content);
    return Response.json({ ok: true, path: p, mode: storeMode() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
