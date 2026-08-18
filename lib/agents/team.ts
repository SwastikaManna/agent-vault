// The Agent Vault team — advanced multi-agent orchestration.
// Level 1: Orchestrator plans → specialists run IN PARALLEL (own context, own tools)
// → Writer composes → Critic reviews. Memory = Obsidian vault (+ optional RAG).
// MCP servers plug external tools in at runtime (Home Assistant, browser, GitHub…).

import { completeWithTools, streamChat, type ChatMsg, type LLMConfig, type ToolCall, type ToolDef } from "@/lib/llm";
import { getStore } from "@/lib/memory-store";
import { listMCPTools, callMCPTool, type MCPServerConfig } from "@/lib/mcp/client";
import { semanticSearch, type EmbedConfig } from "@/lib/rag";
import { flightStatus, type AmadeusConfig } from "@/lib/travel";
import type { AgentRole } from "./roster";

export interface ChatEvent {
  type: "agent" | "tool" | "text" | "plan" | "done" | "error";
  agent?: AgentRole;
  status?: string;
  tool?: string;
  args?: unknown;
  result?: string;
  delta?: string;
  error?: string;
  tasks?: { agent: AgentRole; instruction: string }[];
}

const ROSTER: Record<AgentRole, string> = {
  orchestrator:
    "You are the Orchestrator. You plan work and assign it to specialists. Think about what must be gathered, written, and verified, then produce a concise plan.",
  researcher:
    "You are the Researcher. Gather information: fetch live web pages with fetch_url, and consult the vault (vault_search / vault_read / vault_semantic_search). Be precise about what you verified and what you could not. Do not save notes — the Librarian does that.",
  writer:
    "You are the Writer. Produce clear, complete, self-contained output. Lead with the answer. Use [[wikilinks]] when referencing vault notes. You may read the vault for context.",
  librarian:
    "You are the Librarian. You own the vault. Save durable knowledge (decisions, research summaries, preferences, project state) as markdown with YAML frontmatter and wikilinks. Paths: Folder/Name.md. Search before writing to avoid duplicates.",
  critic:
    "You are the Critic. Review the team's work for accuracy, completeness, and overclaiming. Check facts against the vault and the web when needed. End your review with either VERDICT: APPROVED or VERDICT: FIX with specific corrections.",
};

const BASE_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch a web page or API endpoint and return its visible text. Use for current information.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "Full https URL" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vault_search",
      description: "Keyword search of the team's Obsidian vault. ALWAYS call before claiming what the team knows.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "vault_read",
      description: "Read a note from the vault by path, e.g. 'Projects/Launch Plan.md'.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "vault_write",
      description: "Save a markdown note to the vault. Paths use folders, e.g. 'Projects/Launch Plan.md'. YAML frontmatter + [[wikilinks]].",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
];

const MAX_SPECIALIST_ITERS = 4;

export interface ChatRequest {
  cfg: LLMConfig;
  history: { role: "user" | "assistant"; content: string }[];
  mcpServers?: MCPServerConfig[];
  embedCfg?: EmbedConfig | null;
  amadeus?: AmadeusConfig | null;
  onEvent: (e: ChatEvent) => void;
}

let vaultCache: { path: string; content: string }[] = [];

async function loadVault(): Promise<{ path: string; content: string }[]> {
  if (vaultCache.length) return vaultCache;
  const store = getStore();
  const nodes = await store.list();
  vaultCache = [];
  for (const n of nodes.filter((x) => x.type === "file")) {
    const content = (await store.read(n.path)) ?? "";
    vaultCache.push({ path: n.path, content });
  }
  return vaultCache;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { mcpServers?: MCPServerConfig[]; embedCfg?: EmbedConfig | null; amadeus?: AmadeusConfig | null; notes: { path: string; content: string }[] }
): Promise<string> {
  switch (name) {
    case "fetch_url": {
      const url = String(args.url ?? "");
      if (!/^https?:\/\//.test(url)) return "Error: only http(s) URLs are allowed.";
      try {
        const res = await fetch(url, { headers: { "User-Agent": "AgentVault/1.0" }, signal: AbortSignal.timeout(15000) });
        const text = await res.text();
        const cleaned = text
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const capped = cleaned.slice(0, 12000);
        return capped.length < cleaned.length ? capped + "\n…[truncated]" : capped || "(empty page)";
      } catch (e) {
        return `Error fetching URL: ${(e as Error).message}`;
      }
    }
    case "vault_search": {
      const q = String(args.query ?? "").toLowerCase();
      const hits: string[] = [];
      for (const n of ctx.notes) {
        if (n.content.toLowerCase().includes(q)) {
          const idx = n.content.toLowerCase().indexOf(q);
          hits.push(`${n.path} → …${n.content.slice(Math.max(0, idx - 60), idx + 120).replace(/\n/g, " ")}…`);
        }
      }
      return hits.length ? hits.slice(0, 8).join("\n") : "No notes match. The team does not know this yet.";
    }
    case "vault_semantic_search": {
      if (!ctx.embedCfg) return "Semantic search is not configured. Use vault_search instead.";
      try {
        const hits = await semanticSearch(ctx.embedCfg, String(args.query ?? ""), ctx.notes);
        return hits.length
          ? hits.map((h) => `${h.path} (score ${h.score.toFixed(2)}) → ${h.snippet}`).join("\n")
          : "No semantically similar notes found.";
      } catch (e) {
        return `Semantic search failed: ${(e as Error).message}. Use vault_search instead.`;
      }
    }
    case "vault_read": {
      const p = String(args.path ?? "");
      if (!p.endsWith(".md") || p.includes("..")) return "Error: invalid note path.";
      const n = ctx.notes.find((x) => x.path === p);
      return n?.content ?? `Note not found: ${p}`;
    }
    case "vault_write": {
      const p = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!p.endsWith(".md") || p.includes("..")) return "Error: invalid note path.";
      if (!content.trim()) return "Error: empty note content.";
      await getStore().write(p, content);
      vaultCache = [];
      return `Saved to vault: ${p}`;
    }
    case "flight_status": {
      if (!ctx.amadeus) return "Amadeus is not configured — add client ID/secret in Settings.";
      try {
        return await flightStatus(ctx.amadeus, String(args.flight_number ?? ""), String(args.date ?? ""));
      } catch (e) {
        return `Flight lookup failed: ${(e as Error).message}`;
      }
    }
    default:
      if (name.startsWith("mcp__")) {
        const r = await callMCPTool(ctx.mcpServers ?? [], name, args);
        return r.ok ? r.text : `Error: ${r.text}`;
      }
      return `Unknown tool: ${name}`;
  }
}

/** One specialist agent: role prompt + instruction + tool loop. Runs independently (parallel-safe). */
async function runSpecialist(
  role: AgentRole,
  instruction: string,
  cfg: LLMConfig,
  tools: ToolDef[],
  ctx: { mcpServers?: MCPServerConfig[]; embedCfg?: EmbedConfig | null; amadeus?: AmadeusConfig | null; notes: { path: string; content: string }[] },
  onEvent: (e: ChatEvent) => void
): Promise<string> {
  const messages: ChatMsg[] = [
    { role: "system", content: ROSTER[role] },
    { role: "user", content: instruction },
  ];
  let iterations = 0;
  let lastText = "";
  while (iterations < MAX_SPECIALIST_ITERS) {
    iterations++;
    onEvent({ type: "agent", agent: role, status: "working" });
    const { content, toolCalls } = await completeWithTools(cfg, messages, tools, { maxTokens: 2048 });
    if (toolCalls.length === 0) {
      lastText = content;
      onEvent({ type: "agent", agent: role, status: "done" });
      return content;
    }
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = { raw: tc.function.arguments };
      }
      onEvent({ type: "tool", agent: role, tool: tc.function.name, args });
      const result = await executeTool(tc.function.name, args, ctx);
      onEvent({ type: "tool", agent: role, tool: tc.function.name, args, result });
      messages.push({ role: "assistant", content: null, tool_calls: [tc as ToolCall] });
      messages.push({ role: "tool", tool_call_id: tc.id, content: result.slice(0, 6000) });
    }
  }
  onEvent({ type: "agent", agent: role, status: "done" });
  return lastText;
}

/** Main team run: plan → parallel specialists → writer → critic. */
export async function runTeam(req: ChatRequest): Promise<void> {
  const { cfg, history, onEvent } = req;
  const userMsg = history.length ? history[history.length - 1].content : "";

  try {
    const notes = await loadVault();
    const ctx = {
      mcpServers: req.mcpServers,
      embedCfg: req.embedCfg,
      amadeus: req.amadeus,
      notes,
    };

    // dynamic tools: base + MCP + optional RAG + optional flight
    const tools: ToolDef[] = [...BASE_TOOLS];
    if (req.embedCfg?.apiKey) {
      tools.push({
        type: "function",
        function: {
          name: "vault_semantic_search",
          description: "Semantic (meaning-based) search over the vault. Use for fuzzy recall, concepts, and synonyms.",
          parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
        },
      });
    }
    if (req.amadeus) {
      tools.push({
        type: "function",
        function: {
          name: "flight_status",
          description: "Look up a flight's current status, times, and route via Amadeus.",
          parameters: {
            type: "object",
            properties: {
              flight_number: { type: "string", description: "e.g. AI123" },
              date: { type: "string", description: "YYYY-MM-DD" },
            },
            required: ["flight_number", "date"],
          },
        },
      });
    }
    const mcpInfo = await listMCPTools(req.mcpServers ?? []);
    for (const t of mcpInfo.tools) {
      tools.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
    for (const e of mcpInfo.errors) {
      onEvent({ type: "error", error: `MCP server "${e.server}": ${e.error}` });
    }

    // ---- Phase 1: Orchestrator plan ----
    onEvent({ type: "agent", agent: "orchestrator", status: "working" });
    const planMsg: ChatMsg[] = [
      {
        role: "system",
        content: `${ROSTER.orchestrator}
The team has these tools available: ${tools.map((t) => t.function.name).join(", ")}.

Respond with ONLY a JSON plan object, no other text:
{"tasks":[{"agent":"researcher|writer|librarian|critic","instruction":"self-contained task"}],"notes":"1-line plan summary"}
Rules: 1-3 tasks. researcher gathers facts, librarian checks/saves memory, writer drafts. Each instruction must be fully self-contained (include any URLs or specifics).`,
      },
      { role: "user", content: userMsg },
    ];

    let tasks: { agent: AgentRole; instruction: string }[] = [];
    let planNotes = "";
    try {
      const { content } = await completeWithTools(cfg, planMsg, [], { maxTokens: 700 });
      const json = content.match(/\{[\s\S]*\}/)?.[0] ?? "";
      const parsed = JSON.parse(json);
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 3) : [];
      planNotes = String(parsed.notes ?? "");
    } catch {
      tasks = [];
    }

    if (tasks.length === 0) {
      // fallback: single writer task
      tasks = [{ agent: "writer", instruction: userMsg }];
      planNotes = "No structured plan produced — running the full request as one task.";
    }
    onEvent({ type: "plan", tasks, error: undefined });
    onEvent({ type: "agent", agent: "orchestrator", status: "done" });

    // ---- Phase 2: parallel specialists ----
    const results = await Promise.all(
      tasks.map((t) => runSpecialist(t.agent, t.instruction, cfg, tools, ctx, onEvent))
    );

    // ---- Phase 3: Writer composes final ----
    onEvent({ type: "agent", agent: "writer", status: "working" });
    const composeMsg: ChatMsg[] = [
      { role: "system", content: ROSTER.writer + "\n\nPlan summary: " + planNotes },
      {
        role: "user",
        content: `Original request: ${userMsg}\n\nSpecialist outputs:\n${tasks
          .map((t, i) => `--- ${t.agent} ---\n${results[i]}`)
          .join("\n\n")}\n\nCompose the final answer. Integrate the best of each output. Mark vault notes referenced with [[wikilinks]].`,
      },
    ];
    let finalDraft = "";
    const { content: draft } = await completeWithTools(cfg, composeMsg, [], { maxTokens: 1500 });
    finalDraft = draft;
    onEvent({ type: "agent", agent: "writer", status: "done" });

    // ---- Phase 4: Critic review ----
    onEvent({ type: "agent", agent: "critic", status: "working" });
    const criticMsg: ChatMsg[] = [
      { role: "system", content: ROSTER.critic },
      {
        role: "user",
        content: `Original request: ${userMsg}\n\nDraft answer:\n${finalDraft}\n\nReview it. Verify claims you can, flag anything unverified or wrong. End with VERDICT: APPROVED or VERDICT: FIX + corrections.`,
      },
    ];
    const { content: review } = await completeWithTools(cfg, criticMsg, tools, { maxTokens: 900 });
    onEvent({ type: "text", agent: "critic", delta: review });
    onEvent({ type: "agent", agent: "critic", status: "done" });

    // ---- Phase 5: stream final (with critic fixes if any) ----
    onEvent({ type: "agent", agent: "writer", status: "working" });
    const needsFix = /VERDICT:\s*FIX/i.test(review);
    const finalText = needsFix
      ? `${finalDraft}\n\n---\n\n**Critic's corrections applied:**\n${review.replace(/VERDICT:\s*FIX/i, "FIX").slice(0, 1200)}`
      : finalDraft;
    for (let i = 0; i < finalText.length; i += 64) {
      onEvent({ type: "text", agent: "writer", delta: finalText.slice(i, i + 64) });
    }
    onEvent({ type: "agent", agent: "writer", status: "done" });
    onEvent({ type: "done" });
  } catch (e) {
    onEvent({ type: "error", error: (e as Error).message });
  }
}
