"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Wrench, KeyRound, Loader2, BookMarked } from "lucide-react";
import TopBar from "@/components/topbar";
import Markdown from "@/components/markdown";
import { consumeSSE } from "@/lib/client/sse";
import { loadSettings } from "@/lib/client/settings";
import { AGENT_COLORS, TEAM_MEMBERS } from "@/lib/agents/roster";

interface TraceItem {
  tool: string;
  args: unknown;
  result: string;
}
interface Msg {
  id: number;
  role: "user" | "agent";
  agent?: string;
  content: string;
  traces: TraceItem[];
  error?: boolean;
}

const SUGGESTIONS = [
  "Research remote work productivity trends and save a summary note",
  "Draft a project plan for launching a small SaaS product",
  "What do you remember about my projects?",
  "Find the latest stable versions of Next.js and Node.js",
];

export default function Workspace() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [savedConv, setSavedConv] = useState(false);
  const [plan, setPlan] = useState<{ agent: string; instruction: string }[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    setHasKey(Boolean(loadSettings().apiKey));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, active]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    const s = loadSettings();
    if (!s.apiKey) {
      window.location.href = "/settings";
      return;
    }
    setSettings(s);

    const history = messages
      .filter((m) => m.role === "user" || m.content)
      .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content || "" }))
      .slice(-10);

    setMessages((prev) => [
      ...prev,
      { id: idRef.current++, role: "user", content: trimmed, traces: [] },
      { id: idRef.current++, role: "agent", agent: "orchestrator", content: "", traces: [] },
    ]);
    setInput("");
    setRunning(true);
    setActive("orchestrator");
    setPlan(null);

    try {
      await consumeSSE(
        "/api/chat",
        {
          provider: s.provider,
          apiKey: s.apiKey,
          model: s.model,
          history: [...history, { role: "user", content: trimmed }],
          mcpServers: s.mcpServers.map((m) => ({
            name: m.name,
            type: m.type,
            command: m.command,
            args: m.args ? m.args.split(" ").filter(Boolean) : [],
            url: m.url,
          })),
          amadeus:
            s.amadeusClientId && s.amadeusClientSecret
              ? { clientId: s.amadeusClientId, clientSecret: s.amadeusClientSecret }
              : undefined,
        },
        (e: {
          type: string;
          agent?: string;
          status?: string;
          tool?: string;
          args?: unknown;
          result?: string;
          delta?: string;
          error?: string;
          tasks?: { agent: string; instruction: string }[];
        }) => {
          if (e.type === "agent") {
            setActive(e.status === "done" ? null : (e.agent ?? null));
          } else if (e.type === "plan") {
            setPlan(e.tasks ?? null);
          } else if (e.type === "tool") {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "agent") {
                last.traces = [...last.traces, { tool: e.tool ?? "", args: e.args ?? {}, result: e.result ?? "" }];
              }
              return next;
            });
          } else if (e.type === "text" && e.delta) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "agent") last.content += e.delta!;
              return next;
            });
          } else if (e.type === "error") {
            setMessages((prev) => {
              const next = [...prev];
              next.push({
                id: idRef.current++,
                role: "agent",
                agent: "orchestrator",
                content: `⚠ ${e.error}`,
                traces: [],
                error: true,
              });
              return next;
            });
          } else if (e.type === "done") {
            setRunning(false);
            setActive(null);
          }
        }
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: "agent", agent: "orchestrator", content: `⚠ ${(err as Error).message}`, traces: [], error: true },
      ]);
    } finally {
      setRunning(false);
      setActive(null);
    }
  }

  const agentLabel = (role: string) => TEAM_MEMBERS.find((m) => m.role === role)?.label ?? role;

  async function saveConversation() {
    if (messages.length === 0) return;
    const now = new Date();
    const body = messages
      .map((m) =>
        m.role === "user"
          ? `## You\n\n${m.content}`
          : `## ${agentLabel(m.agent ?? "Agent")}\n\n${m.content}` +
            (m.traces.length
              ? "\n\n" +
                m.traces
                  .map((t) => `<details><summary>${t.tool} ${JSON.stringify(t.args)}</summary>\n\n${t.result}\n\n</details>`)
                  .join("\n\n")
              : "")
      )
      .join("\n\n---\n\n");
    const stamp = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5).replace(":", "-")}`;
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `Conversations/${stamp}.md`,
        content: `---\ncreated: ${now.toISOString().slice(0, 10)}\ntags: [conversation]\n---\n\n# Conversation — ${stamp}\n\n${body}`,
      }),
    });
    if (res.ok) {
      setSavedConv(true);
      setTimeout(() => setSavedConv(false), 2000);
    }
  }

  return (
    <>
      <TopBar
        title="Workspace"
        subtitle="Give the team a task — they research, draft, and save to your vault"
        right={
          <>
            {messages.length > 0 && !running && (
              <button className="btn" onClick={() => void saveConversation()} disabled={savedConv}>
                <BookMarked size={13} className={savedConv ? "text-ok" : ""} />
                {savedConv ? "Saved to vault ✓" : "Save conversation"}
              </button>
            )}
            {!hasKey ? (
              <Link href="/settings" className="btn">
                <KeyRound size={13} className="text-warn" /> Add API key
              </Link>
            ) : (
              <span className="pill">
                <span className="w-[6px] h-[6px] rounded-full bg-ok pulse-dot" />
                {settings.provider} · {settings.model}
              </span>
            )}
          </>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col">
        {/* messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-6 py-8">
            {messages.length === 0 && (
              <div className="pt-10 pb-6">
                <h2 className="text-[22px] font-[510] tracking-[-0.4px] text-ink">
                  What should the team do?
                </h2>
                <p className="mt-2 text-[13.5px] text-muted leading-relaxed">
                  The team checks its vault before answering, fetches the web when it needs current
                  facts, and saves anything durable as notes you can open in Obsidian.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="pill hover:bg-white/[0.06] transition-colors text-left max-w-full" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-accent/20 border border-accent/30 rounded-lg px-4 py-2.5 text-[13.5px] text-ink leading-relaxed rise">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="rise">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-[7px] h-[7px] rounded-full"
                        style={{ background: m.error ? "#f87171" : AGENT_COLORS[m.agent ?? ""] ?? "#8a8f98" }}
                      />
                      <span className="text-[11px] font-[510] uppercase tracking-[0.06em] text-faint">
                        {agentLabel(m.agent ?? "orchestrator")}
                      </span>
                    </div>
                    <div className="pl-[15px] border-l border-linesub">
                      {m.traces.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {m.traces.map((t, i) => (
                            <details key={i} className="group" open={i === m.traces.length - 1}>
                              <summary className="cursor-pointer list-none flex items-center gap-2 text-[11.5px] mono text-faint hover:text-silver">
                                <Wrench size={11} className="text-accent2" />
                                {t.tool}
                                <span className="truncate max-w-[380px] text-faint/70">
                                  {typeof t.args === "object" && t.args !== null
                                    ? Object.entries(t.args as Record<string, unknown>)
                                        .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
                                        .join("  ")
                                    : String(t.args)}
                                </span>
                              </summary>
                              <pre className="mt-2 text-[11px] mono text-muted bg-panel border border-linesub rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                                {t.result}
                              </pre>
                            </details>
                          ))}
                        </div>
                      )}
                      <Markdown text={m.content || (running && m.id === messages[messages.length - 1]?.id ? "…" : "")} />
                    </div>
                  </div>
                )
              )}

              {running && (
                <div className="flex items-center gap-2 text-[11.5px] text-faint mono">
                  <Loader2 size={12} className="animate-spin text-accent2" />
                  {active ? `${agentLabel(active)} working…` : "team thinking…"}
                </div>
              )}

              {plan && plan.length > 0 && (
                <div className="card p-3">
                  <div className="text-[10px] font-[510] uppercase tracking-[0.08em] text-faint mb-2">Plan</div>
                  <div className="space-y-1.5">
                    {plan.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px]">
                        <span
                          className="w-[6px] h-[6px] rounded-full mt-1 shrink-0"
                          style={{ background: AGENT_COLORS[t.agent] ?? "#8a8f98" }}
                        />
                        <span className="text-muted leading-snug">
                          <span className="text-silver font-[510]">{agentLabel(t.agent)}</span>
                          {" — "}
                          {t.instruction}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* input */}
        <div className="shrink-0 border-t border-linesub bg-panel/60 backdrop-blur">
          <div className="max-w-[760px] mx-auto px-6 py-4">
            <div className="flex items-end gap-2">
              <textarea
                className="input resize-none min-h-[44px] max-h-[160px] py-3"
                rows={1}
                placeholder={
                  hasKey
                    ? "Ask the team… e.g. “Research pricing for AI note apps and save a comparison note”"
                    : "Add your API key in Settings to start"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button className="btn btn-primary h-[44px] px-4 shrink-0" onClick={() => send(input)} disabled={running || !input.trim()}>
                <Send size={14} />
              </button>
            </div>
            <p className="mt-2 text-[10.5px] text-faint">
              Your API key stays in this browser. Durable knowledge is saved to the vault — your markdown, your data.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
