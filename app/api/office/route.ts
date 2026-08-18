import { completeWithTools, providerBaseUrl, KEYLESS_PROVIDERS } from "@/lib/llm";
import { buildPptx, buildDocx, buildXlsx, fallbackOutline, type OfficeKind, type DeckSlide, type DocSection } from "@/lib/office";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<OfficeKind, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const EXT: Record<OfficeKind, string> = { pptx: "pptx", docx: "docx", xlsx: "xlsx" };

export async function POST(req: Request) {
  let body: { kind?: OfficeKind; idea?: string; provider?: string; apiKey?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const kind = body.kind === "docx" || body.kind === "xlsx" ? body.kind : "pptx";
  const idea = String(body.idea ?? "").trim();
  if (!idea) return Response.json({ error: "Give me an idea first." }, { status: 400 });

  const provider = body.provider || "openai";
  const apiKey = body.apiKey?.trim() ?? "";
  const useLLM = Boolean(apiKey) || KEYLESS_PROVIDERS.has(provider);
  const cfg = { baseUrl: providerBaseUrl(provider), apiKey, model: body.model?.trim() || "gpt-4o-mini" };

  try {
    let outline: { slides?: DeckSlide[]; sections?: DocSection[]; rows?: string[][] } | null = null;

    if (useLLM) {
      const shape =
        kind === "pptx"
          ? '{"slides":[{"title":"...","bullets":["...","..."]}]} (6-10 slides, punchy titles)'
          : kind === "docx"
            ? '{"sections":[{"heading":"...","body":"paragraph text"}]} (3-6 sections)'
            : '{"rows":[["Header1","Header2"],["value","value"]]} (header row + 8-15 data rows)';
      try {
        const { content } = await completeWithTools(
          cfg,
          [
            {
              role: "system",
              content: `You turn an idea into a structured outline for a ${kind.toUpperCase()} document. Respond with ONLY JSON in this shape: ${shape}. No other text.`,
            },
            { role: "user", content: idea },
          ],
          [],
          { maxTokens: 1600 }
        );
        outline = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? "null");
      } catch {
        outline = null; // LLM unavailable → template fallback below
      }
    }

    if (!outline) outline = fallbackOutline(kind, idea);

    let buffer: Buffer;
    if (kind === "pptx") buffer = await buildPptx(outline.slides ?? [{ title: idea.slice(0, 60), bullets: [idea] }]);
    else if (kind === "docx") buffer = await buildDocx(outline.sections ?? [{ heading: idea.slice(0, 60), body: idea }]);
    else buffer = await buildXlsx(outline.rows ?? [["Topic"], [idea.slice(0, 60)]]);

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Blob([new Uint8Array(buffer)]), {
      headers: {
        "Content-Type": MIME[kind],
        "Content-Disposition": `attachment; filename="agent-vault-${stamp}.${EXT[kind]}"`,
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
