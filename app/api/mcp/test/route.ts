import { listMCPTools, type MCPServerConfig } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { server?: MCPServerConfig };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.server?.name) return Response.json({ error: "Server name required" }, { status: 400 });
  const { tools, errors } = await listMCPTools([body.server]);
  if (errors.length) return Response.json({ ok: false, error: errors[0].error });
  return Response.json({
    ok: true,
    tools: tools.map((t) => t.name.replace(/^mcp__[^_]+__/, "")),
  });
}
