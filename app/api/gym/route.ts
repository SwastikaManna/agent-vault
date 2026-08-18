import { runGymTask, type GymEvent } from "@/lib/gym/runner";
import { providerBaseUrl } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { provider?: string; apiKey?: string; model?: string; taskId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) return new Response("Missing API key — add one in Settings.", { status: 400 });
  const provider = body.provider || "openai";
  const model = body.model?.trim() || "gpt-4o-mini";
  const taskId = body.taskId;
  if (!taskId) return new Response("Missing taskId", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: GymEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        await runGymTask({ baseUrl: providerBaseUrl(provider), apiKey, model }, taskId, send);
      } catch (e) {
        send({ type: "result", error: (e as Error).message });
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
