"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, Database, GitBranch, ShieldCheck } from "lucide-react";
import TopBar from "@/components/topbar";
import { PROVIDERS } from "@/lib/llm";
import { loadSettings, saveSettings, type AppSettings } from "@/lib/client/settings";

export default function Settings() {
  const [s, setS] = useState<AppSettings>(loadSettings());
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<string>("local");
  const [version, setVersion] = useState("");

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
