"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, Database, GitBranch, ShieldCheck, Plug, Plane, Loader2 } from "lucide-react";
import TopBar from "@/components/topbar";
import { PROVIDERS } from "@/lib/llm";
import { loadSettings, saveSettings, type AppSettings, type MCPServerSetting } from "@/lib/client/settings";

export default function Settings() {
  const [s, setS] = useState<AppSettings>(loadSettings());
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<string>("local");
  const [version, setVersion] = useState("");
  const [mcpTesting, setMcpTesting] = useState<string | null>(null);
  const [mcpTestResult, setMcpTestResult] = useState<Record<string, string>>({});
  const [newServer, setNewServer] = useState<MCPServerSetting>({ name: "", type: "stdio", command: "", args: "", url: "" });

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((j) => {
        setMode(j.mode);
        setVersion(j.version);
      })
      .catch(() => {});
  }, []);

  function save() {
    saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function testMcp(server: MCPServerSetting) {
    setMcpTesting(server.name);
    setMcpTestResult((r) => ({ ...r, [server.name]: "Testing…" }));
    try {
      const res = await fetch("/api/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server }),
      });
      const j = await res.json();
      setMcpTestResult((r) => ({
        ...r,
        [server.name]: j.ok ? `✓ ${j.tools.length} tools: ${j.tools.join(", ")}` : `✗ ${j.error}`,
      }));
    } catch (e) {
      setMcpTestResult((r) => ({ ...r, [server.name]: `✗ ${(e as Error).message}` }));
    } finally {
      setMcpTesting(null);
    }
  }

  function addMcpServer() {
    if (!newServer.name.trim()) return;
    const server: MCPServerSetting = {
      name: newServer.name.trim(),
      type: newServer.type,
      command: newServer.command?.trim() || undefined,
      args: newServer.args?.trim() || undefined,
      url: newServer.url?.trim() || undefined,
    };
    setS({ ...s, mcpServers: [...s.mcpServers, server] });
    setNewServer({ name: "", type: "stdio", command: "", args: "", url: "" });
  }

  return (
    <>
      <TopBar title="Settings" subtitle="Bring your own key — nothing is stored on a server" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-8 py-10 space-y-6">
          {/* LLM */}
          <section className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={14} className="text-accent2" />
              <h2 className="text-[15px] font-[510] text-ink">Model provider</h2>
            </div>
            <p className="text-[12px] text-muted mb-5">
              Agent Vault is BYOK. Your key is stored only in this browser (localStorage) and sent
              directly to your provider — never to our servers.
            </p>

            <label className="block text-[11px] font-[510] uppercase tracking-[0.06em] text-faint mb-1.5">
              Provider
            </label>
            <select
              className="input mb-4"
              value={s.provider}
              onChange={(e) => {
                const p = e.target.value;
                setS({ ...s, provider: p, model: PROVIDERS[p]?.defaultModel ?? s.model });
              }}
            >
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id} className="bg-surface">
                  {p.label} — {p.baseUrl}
                </option>
              ))}
            </select>

            <label className="block text-[11px] font-[510] uppercase tracking-[0.06em] text-faint mb-1.5">
              API key
            </label>
            <input
              type="password"
              className="input mb-4 mono"
              placeholder="sk-…"
              value={s.apiKey}
              onChange={(e) => setS({ ...s, apiKey: e.target.value })}
            />

            <label className="block text-[11px] font-[510] uppercase tracking-[0.06em] text-faint mb-1.5">
              Model
            </label>
            <select
              className="input mb-4"
              value={s.model}
              onChange={(e) => setS({ ...s, model: e.target.value })}
            >
              {(PROVIDERS[s.provider]?.models ?? []).map((m) => (
                <option key={m} value={m} className="bg-surface">
                  {m}
                </option>
              ))}
            </select>

            <button className="btn btn-primary" onClick={save}>
              <Save size={13} /> {saved ? "Saved ✓" : "Save settings"}
            </button>
          </section>

          {/* Memory */}
          <section className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Database size={14} className="text-accent2" />
              <h2 className="text-[15px] font-[510] text-ink">Memory — your Obsidian vault</h2>
            </div>
            <p className="text-[12px] text-muted leading-relaxed mb-4">
              All durable knowledge is written as markdown notes. You own them: open the vault folder
              in Obsidian (free) or clone the GitHub repo and sync with Obsidian Git.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <span className={`tag ${mode === "github" ? "!text-ok" : "!text-warn"}`}>
                {mode === "github" ? "GitHub-backed" : "local folder"}
              </span>
              {mode === "github" ? (
                <span className="text-[11.5px] text-faint">writes commit to the memory repo automatically</span>
              ) : (
                <span className="text-[11.5px] text-faint">writes to ./vault in this project</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-faint">
              <GitBranch size={12} />
              <span className="mono">MEMORY_REPO + GITHUB_TOKEN env vars switch to GitHub-backed mode on Vercel</span>
            </div>
          </section>

          {/* MCP servers */}
          <section className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Plug size={14} className="text-accent2" />
              <h2 className="text-[15px] font-[510] text-ink">MCP servers</h2>
            </div>
            <p className="text-[12px] text-muted mb-4">
              Connect the team to external tools via Model Context Protocol: Home Assistant, browser
              automation, GitHub, filesystem, databases… stdio servers run locally; HTTP servers
              work anywhere (including Vercel).
            </p>

            {s.mcpServers.map((server) => (
              <div key={server.name} className="flex items-center gap-2 mb-2">
                <span className="tag">{server.type}</span>
                <span className="text-[12.5px] mono text-silver">{server.name}</span>
                <span className="text-[11px] text-faint truncate">
                  {server.type === "http" ? server.url : `${server.command} ${server.args ?? ""}`}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    className="btn !py-1 !px-2.5"
                    onClick={() => void testMcp(server)}
                    disabled={mcpTesting !== null}
                  >
                    {mcpTesting === server.name ? <Loader2 size={11} className="animate-spin" /> : "Test"}
                  </button>
                  <button
                    className="btn !py-1 !px-2.5"
                    onClick={() => setS({ ...s, mcpServers: s.mcpServers.filter((x) => x.name !== server.name) })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {Object.entries(mcpTestResult).map(([name, r]) => (
              <p key={name} className="text-[11px] mono text-muted mb-2">{name}: {r}</p>
            ))}

            <div className="flex flex-wrap gap-2 mt-3">
              <input className="input !w-40" placeholder="Name (e.g. home-assistant)" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} />
              <select className="input !w-32" value={newServer.type} onChange={(e) => setNewServer({ ...newServer, type: e.target.value as "stdio" | "http" })}>
                <option value="stdio" className="bg-surface">stdio (local)</option>
                <option value="http" className="bg-surface">http (remote)</option>
              </select>
              {newServer.type === "http" ? (
                <input className="input !w-64" placeholder="https://mcp-server.example.com/mcp" value={newServer.url} onChange={(e) => setNewServer({ ...newServer, url: e.target.value })} />
              ) : (
                <>
                  <input className="input !w-48" placeholder="command (e.g. npx)" value={newServer.command} onChange={(e) => setNewServer({ ...newServer, command: e.target.value })} />
                  <input className="input !w-56" placeholder="args (e.g. @modelcontextprotocol/server-filesystem ./vault)" value={newServer.args} onChange={(e) => setNewServer({ ...newServer, args: e.target.value })} />
                </>
              )}
              <button className="btn" onClick={addMcpServer}>
                Add server
              </button>
            </div>
            <p className="mt-3 text-[10.5px] text-faint">
              After adding, hit <b>Save settings</b>. MCP tools appear in the Workspace as{" "}
              <span className="mono">mcp__&lt;server&gt;__&lt;tool&gt;</span>.
            </p>
          </section>

          {/* Travel */}
          <section className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Plane size={14} className="text-accent2" />
              <h2 className="text-[15px] font-[510] text-ink">Travel — Amadeus (free tier)</h2>
            </div>
            <p className="text-[12px] text-muted mb-4">
              Get a free Self-Service key at developers.amadeus.com → the team can check flights and
              file itineraries itself. Alternatively set <span className="mono">AMADEUS_CLIENT_ID/SECRET</span> env vars.
            </p>
            <div className="flex gap-2">
              <input className="input mono" placeholder="Amadeus client ID" value={s.amadeusClientId} onChange={(e) => setS({ ...s, amadeusClientId: e.target.value })} />
              <input className="input mono" type="password" placeholder="Amadeus client secret" value={s.amadeusClientSecret} onChange={(e) => setS({ ...s, amadeusClientSecret: e.target.value })} />
            </div>
          </section>

          {/* Privacy */}
          <section className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={14} className="text-ok" />
              <h2 className="text-[15px] font-[510] text-ink">Privacy model</h2>
            </div>
            <ul className="text-[12.5px] text-muted space-y-1.5 leading-relaxed">
              <li>• API keys: browser-only, never logged</li>
              <li>• Conversations: processed by your chosen provider, not stored by Agent Vault</li>
              <li>• Memory: your vault, your repo, your data — exportable as plain markdown any time</li>
              <li>• Web fetches: server-side, stripped to text, capped at 12KB</li>
            </ul>
            <p className="mt-4 text-[10.5px] text-faint mono">agent-vault v{version || "1.0.0"}</p>
          </section>
        </div>
      </div>
    </>
  );
}
