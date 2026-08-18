// MCP (Model Context Protocol) client — connects the agent team to external
// tool servers: Home Assistant, browser automation, GitHub, filesystem, etc.
// stdio servers work in local/self-hosted mode; streamable-HTTP servers work anywhere.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface MCPServerConfig {
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
}

export interface MCPToolInfo {
  server: string;
  name: string; // namespaced: mcp__<server>__<tool>
  description: string;
  parameters: Record<string, unknown>;
}

export interface MCPCallResult {
  ok: boolean;
  text: string;
}

function toNamespaced(server: string, tool: string): string {
  return `mcp__${server}__${tool}`;
}

export async function listMCPTools(
  servers: MCPServerConfig[]
): Promise<{ tools: MCPToolInfo[]; errors: { server: string; error: string }[] }> {
  const tools: MCPToolInfo[] = [];
  const errors: { server: string; error: string }[] = [];

  for (const cfg of servers) {
    if (!cfg.name?.trim()) continue;
    const client = new Client({ name: "agent-vault", version: "1.0.0" }, { capabilities: {} });
    try {
      let transport;
      if (cfg.type === "http" && cfg.url) {
        transport = new StreamableHTTPClientTransport(new URL(cfg.url));
      } else if (cfg.type === "stdio" && cfg.command) {
        transport = new StdioClientTransport({ command: cfg.command, args: cfg.args ?? [] });
      } else {
        errors.push({ server: cfg.name, error: "Invalid config" });
        continue;
      }
      await client.connect(transport);
      const listed = await client.listTools();
      for (const t of listed.tools) {
        tools.push({
          server: cfg.name,
          name: toNamespaced(cfg.name, t.name),
          description: t.description ?? `Tool from ${cfg.name}`,
          parameters: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
        });
      }
    } catch (e) {
      errors.push({ server: cfg.name, error: (e as Error).message.slice(0, 200) });
    } finally {
      try {
        await client.close();
      } catch {
        // ignore close errors
      }
    }
  }
  return { tools, errors };
}

export async function callMCPTool(
  servers: MCPServerConfig[],
  namespacedName: string,
  args: Record<string, unknown>
): Promise<MCPCallResult> {
  const parts = namespacedName.split("__");
  const serverName = parts[1];
  const toolName = parts.slice(2).join("__");
  const cfg = servers.find((s) => s.name === serverName);
  if (!cfg) return { ok: false, text: `MCP server "${serverName}" not configured.` };

  const client = new Client({ name: "agent-vault", version: "1.0.0" }, { capabilities: {} });
  try {
    let transport;
    if (cfg.type === "http" && cfg.url) {
      transport = new StreamableHTTPClientTransport(new URL(cfg.url));
    } else if (cfg.type === "stdio" && cfg.command) {
      transport = new StdioClientTransport({ command: cfg.command, args: cfg.args ?? [] });
    } else {
      return { ok: false, text: "Invalid MCP config." };
    }
    await client.connect(transport);
    const res = await client.callTool({ name: toolName, arguments: args });
    const content = (res.content as { type?: string; text?: string }[] | undefined) ?? [];
    const text = content
      .map((c) => (c.type === "text" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
    return { ok: !res.isError, text: text || "(no text output)" };
  } catch (e) {
    return { ok: false, text: `MCP call failed: ${(e as Error).message.slice(0, 300)}` };
  } finally {
    try {
      await client.close();
    } catch {
      // ignore
    }
  }
}
