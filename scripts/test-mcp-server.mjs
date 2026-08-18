// Minimal MCP stdio test server — proves Agent Vault's MCP plumbing end to end.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "test-mcp", version: "1.0.0" });

server.registerTool(
  "ping",
  { description: "Replies pong", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: "pong" }] })
);

server.registerTool(
  "add",
  { description: "Adds two numbers", inputSchema: { a: z.number(), b: z.number() } },
  async (args) => ({ content: [{ type: "text", text: String(args.a + args.b) }] })
);

await server.connect(new StdioServerTransport());
