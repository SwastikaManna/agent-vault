// RAG semantic memory — vector search over the vault.
// Uses the BYOK provider's embeddings endpoint (OpenAI / NVIDIA NIM / OpenRouter-compatible).
// Falls back to keyword search when no embeddings are configured.

export interface EmbedConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const EMBED_DEFAULTS: Record<string, EmbedConfig> = {
  openai: { baseUrl: "https://api.openai.com/v1", apiKey: "", model: "text-embedding-3-small" },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: "",
    model: "nvidia/nv-embed-qa-4",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: "openai/text-embedding-3-small",
  },
};

async function embed(
  cfg: EmbedConfig,
  texts: string[]
): Promise<number[][]> {
  const res = await fetch(`${cfg.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.model, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Embeddings ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.data ?? []).map((d: { embedding: number[] }) => d.embedding);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function chunkNote(path: string, content: string, size = 700): { path: string; text: string }[] {
  const chunks: { path: string; text: string }[] = [];
  const lines = content.split("\n");
  let buf = "";
  for (const line of lines) {
    if (buf.length + line.length > size && buf.trim()) {
      chunks.push({ path, text: buf.trim() });
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf.trim()) chunks.push({ path, text: buf.trim() });
  return chunks;
}

export interface RagHit {
  path: string;
  score: number;
  snippet: string;
}

/** Semantic search over vault notes. Returns [] if embeddings fail — callers should fall back to keyword. */
export async function semanticSearch(
  cfg: EmbedConfig,
  query: string,
  notes: { path: string; content: string }[],
  topK = 3
): Promise<RagHit[]> {
  if (!cfg.apiKey) return [];
  const chunks = notes.flatMap((n) => chunkNote(n.path, n.content));
  if (chunks.length === 0) return [];

  const queryVec = (await embed(cfg, [query]))[0];
  // embed in batches of 16
  const hits: RagHit[] = [];
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const vecs = await embed(cfg, batch.map((c) => c.text));
    batch.forEach((c, j) => {
      const score = cosine(queryVec, vecs[j]);
      hits.push({ path: c.path, score, snippet: c.text.slice(0, 300) });
    });
  }
  return hits
    .filter((h) => h.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
