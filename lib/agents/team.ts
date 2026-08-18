// The Agent Vault team — orchestrator + specialist roles.
// One LLM plays the team; the orchestrator assigns work, specialists execute
// via tools (web fetch, vault memory), and the UI shows who's speaking.
// The vault is the team's shared memory: notes persist as Obsidian markdown.

import { completeWithTools, streamChat, type ChatMsg, type LLMConfig, type ToolCall, type ToolDef } from "@/lib/llm";
import { getStore } from "@/lib/memory-store";
import type { AgentRole } from "./roster";

export interface ChatEvent {
  type: "agent" | "tool" | "text" | "done" | "error";
  agent?: AgentRole;
  status?: string; // working / done
  tool?: string;
  args?: unknown;
  result?: string;
  delta?: string;
  error?: string;
}

const TEAM_SYSTEM = `You are the Agent Vault team — a group of AI specialists working together on the user's behalf.

TEAM ROSTER:
- Orchestrator: plans the work, assigns tasks to specialists, keeps the goal in mind. You play this role when starting a task or deciding next steps.
- Researcher: gathers information. Uses fetch_url to read web pages and vault_search/vault_read to consult the team's memory.
- Writer: produces final answers, drafts, and documents.
- Librarian: owns the team's memory. Uses vault_write to save durable knowledge as markdown notes, vault_read/vault_search to recall it. Notes live in an Obsidian vault the user owns.
- Critic: reviews work for accuracy before it ships.

WORKFLOW:
1. As Orchestrator, understand the request and plan.
2. Hand off to specialists via tool calls. Researcher gathers facts, Librarian checks memory.
3. Writer produces the answer. If the answer is durable knowledge, Librarian saves it to the vault.
4. If the request is risky or factual, Critic reviews.

RULES:
- Always check the vault BEFORE answering from memory — vault_search first.
- Save anything durable (decisions, research summaries, user preferences, project state) to the vault with vault_write.
- Use fetch_url for current web information. The result is raw text; be honest about what you could and could not verify.
- Final answers must be complete and self-contained. When you cite the vault, use [[wikilink]] syntax.
- If you have nothing more to do, write the final answer as plain text (no tools).`;

const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Fetch a web page or API endpoint and return its visible text. Use for current information the team does not already know.",
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
      description:
        "Search the team's Obsidian vault for a query. Returns matching note names with snippets. ALWAYS call this before claiming what the team knows.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vault_read",
      description: "Read a note from the vault by path, e.g. 'Projects/Launch Plan.md'.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Note path ending in .md" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vault_write",
      description:
        "Save a markdown note to the vault. Paths use folders, e.g. 'Projects/Launch Plan.md'. Use YAML frontmatter for metadata and [[wikilinks]] to connect notes.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Note path ending in .md" },
          content: { type: "string", description: "Full markdown content" },
        },
        required: ["path", "content"],
      },
    },
  },
];

const MAX_ITERATIONS = 10;

function roleForTool(name: string): AgentRole {
  if (name === "fetch_url") return "researcher";
  if (name.startsWith("vault_")) return "librarian";
  return "orchestrator";
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const store = getStore();
  switch (name) {
    case "fetch_url": {
      const url = String(args.url ?? "");
      if (!/^https?:\/\//.test(url)) return "Error: only http(s) URLs are allowed.";
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "AgentVault/1.0" },
          signal: AbortSignal.timeout(15000),
        });
        const text = await res.text();
        const cleaned = text
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const capped = cleaned.slice(0, 12000);
        return capped.length < cleaned.length
          ? capped + "\n…[truncated]"
          : capped || "(empty page)";
      } catch (e) {
        return `Error fetching URL: ${(e as Error).message}`;
      }
    }
    case "vault_search": {
      const q = String(args.query ?? "").toLowerCase();
      const nodes = await store.list();
      const hits: string[] = [];
      for (const n of nodes.filter((x) => x.type === "file").slice(0, 60)) {
        const content = (await store.read(n.path)) ?? "";
        if (content.toLowerCase().includes(q)) {
          const idx = content.toLowerCase().indexOf(q);
          const snip = content.slice(Math.max(0, idx - 60), idx + 120).replace(/\n/g, " ");
          hits.push(`${n.path} → …${snip}…`);
        }
      }
      return hits.length ? hits.join("\n") : "No notes match. The team does not know this yet.";
    }
    case "vault_read": {
      const p = String(args.path ?? "");
      if (!p.endsWith(".md") || p.includes("..")) return "Error: invalid note path.";
      const content = await store.read(p);
      return content ?? `Note not found: ${p}`;
    }
    case "vault_write": {
      const p = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!p.endsWith(".md") || p.includes("..")) return "Error: invalid note path.";
      if (!content.trim()) return "Error: empty note content.";
      await store.write(p, content);
      return `Saved to vault: ${p}`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export interface ChatRequest {
  cfg: LLMConfig;
  history: { role: "user" | "assistant"; content: string }[];
  onEvent: (e: ChatEvent) => void;
}

/** Run the team on a user request. Emits SSE-style events. */
export async function runTeam(req: ChatRequest): Promise<void> {
  const { cfg, history, onEvent } = req;
  const store = getStore();

  try {
    onEvent({ type: "agent", agent: "orchestrator", status: "working" });

    const messages: ChatMsg[] = [{ role: "system", content: TEAM_SYSTEM }];
    for (const h of history) messages.push({ role: h.role, content: h.content });
    messages.push({ role: "user", content: history.length ? history[history.length - 1].content : "" });

    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const { content, toolCalls } = await completeWithTools(cfg, messages, TOOLS);

      if (toolCalls.length === 0) {
        // final answer — Writer/Critic voice
        onEvent({ type: "agent", agent: "writer", status: "working" });
        if (content) {
          // emit in ~60-char chunks for a natural streaming feel
          for (let i = 0; i < content.length; i += 64) {
            onEvent({ type: "text", agent: "writer", delta: content.slice(i, i + 64) });
          }
        } else {
          const full = await streamChat(cfg, messages, {
            onDelta: (d) => onEvent({ type: "text", agent: "writer", delta: d }),
          });
          void full;
        }
        onEvent({ type: "agent", agent: "writer", status: "done" });
        onEvent({ type: "done" });
        return;
      }

      for (const tc of toolCalls) {
        const role = roleForTool(tc.function.name);
        onEvent({ type: "agent", agent: role, status: "working" });
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = { raw: tc.function.arguments };
        }
        onEvent({ type: "tool", agent: role, tool: tc.function.name, args });
        const result = await executeTool(tc.function.name, args);
        onEvent({ type: "tool", agent: role, tool: tc.function.name, args, result });
        onEvent({ type: "agent", agent: role, status: "done" });
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [tc as ToolCall],
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.slice(0, 6000),
        });
      }
    }

    // iteration cap — force a plain-text wrap-up
    const { content } = await completeWithTools(
      cfg,
      [...messages, { role: "user", content: "Wrap up now: give the final answer in plain text." }],
      [],
      { maxTokens: 1024 }
    );
    onEvent({ type: "agent", agent: "writer", status: "working" });
    onEvent({ type: "text", agent: "writer", delta: content });
    onEvent({ type: "agent", agent: "writer", status: "done" });
    onEvent({ type: "done" });
  } catch (e) {
    onEvent({ type: "error", error: (e as Error).message });
  }
}
