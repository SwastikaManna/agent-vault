import { runTeam, type ChatEvent } from "@/lib/agents/team";
import { providerBaseUrl, KEYLESS_PROVIDERS } from "@/lib/llm";
import { EMBED_DEFAULTS, type EmbedConfig } from "@/lib/rag";
import type { MCPServerConfig } from "@/lib/mcp/client";
import { amadeusFromEnv, type AmadeusConfig } from "@/lib/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    provider?: string;
    apiKey?: string;
    model?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    mcpServers?: MCPServerConfig[];
    amadeus?: { clientId?: string; clientSecret?: string };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const provider = body.provider || "openai";
  const apiKey = body.apiKey?.trim() ?? "";
  if (!apiKey && !KEYLESS_PROVIDERS.has(provider)) {
    return new Response("Missing API key — use the free Pollinations provider or add a key in Settings.", { status: 400 });
  }
  const model = body.model?.trim() || "gpt-4o-mini";
  const history = Array.isArray(body.history) ? body.history : [];

  // embeddings: derive from the chat provider's defaults (same key)
  let embedCfg: EmbedConfig | null = null;
  if (EMBED_DEFAULTS[provider]) {
    embedCfg = { ...EMBED_DEFAULTS[provider], apiKey };
  }

  // amadeus: env vars win, else client-supplied creds
  let amadeus: AmadeusConfig | null = amadeusFromEnv();
  if (!amadeus && body.amadeus?.clientId && body.amadeus?.clientSecret) {
    amadeus = { clientId: body.amadeus.clientId, clientSecret: body.amadeus.clientSecret };
  }

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
            mcpServers: body.mcpServers,
            embedCfg,
            amadeus,
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
