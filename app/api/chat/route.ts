import { runTeam, type ChatEvent } from "@/lib/agents/team";
import { providerBaseUrl } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    provider?: string;
    apiKey?: string;
    model?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return new Response("Missing API key — add one in Settings.", { status: 400 });
  }
  const provider = body.provider || "openai";
  const model = body.model?.trim() || "gpt-4o-mini";
  const history = Array.isArray(body.history) ? body.history : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        await runTeam(
          {
            cfg: { baseUrl: providerBaseUrl(provider), apiKey, model },
            history,
            onEvent: send,
          },
        );
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
