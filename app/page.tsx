"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Presentation, Users, Zap, FileText } from "lucide-react";
import TopBar from "@/components/topbar";
import { TEAM_MEMBERS } from "@/lib/agents/roster";
import { STACK } from "@/lib/stack";

interface Stats {
  notes: number;
  folders: number;
  lastModified: string;
}
interface RecentNote {
  path: string;
  mtime: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [mode, setMode] = useState<string>("local");

  useEffect(() => {
    fetch("/api/memory?stats=1")
      .then((r) => r.json())
      .then((j) => {
        setStats(j.stats);
        setMode(j.mode);
      })
      .catch(() => {});
    fetch("/api/memory")
      .then((r) => r.json())
      .then((j) => {
        const files = (j.nodes ?? []).filter((n: { type: string }) => n.type === "file");
        setRecent(files.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Your AI team, with a memory you own"
        right={
          <Link href="/workspace" className="btn btn-primary">
            <Zap size={13} /> Start working
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto relative">
        {/* ambient orbs */}
        <div className="orb w-[420px] h-[420px] bg-[#5e6ad2]/[0.14] top-[-120px] right-[-80px]" />
        <div className="orb w-[380px] h-[380px] bg-[#38bdf8]/[0.08] top-[38%] left-[-140px]" style={{ animationDelay: "-6s" }} />
        <div className="orb w-[300px] h-[300px] bg-[#7170ff]/[0.10] bottom-[-100px] right-[22%]" style={{ animationDelay: "-11s" }} />

        <div className="max-w-[1100px] mx-auto px-8 py-10 relative">
          {/* hero */}
          <div className="mb-10 fade-up">
            <h2 className="text-[32px] font-[510] tracking-[-0.704px] text-ink leading-tight">
              A team of agents that
              <br />
              <span className="gradient-text">actually remembers.</span>
            </h2>
            <p className="mt-3 text-[15px] text-muted max-w-[560px] leading-relaxed">
              Agent Vault runs a team of specialists — researcher, writer, librarian, critic — on
              your tasks. Everything durable lands in an Obsidian-compatible markdown vault you own:
              open it in Obsidian for free, sync it with git, keep it forever. No API key required —
              the free Pollinations provider is the default.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Link href="/workspace" className="btn btn-primary">
                <Zap size={13} /> Open Workspace <ArrowRight size={13} />
              </Link>
              <Link href="/vault" className="btn">
                <BookOpen size={13} /> Browse the vault
              </Link>
              <Link href="/office" className="btn">
                <Presentation size={13} /> Make a deck
              </Link>
            </div>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-3 mb-10 fade-up" style={{ animationDelay: "0.1s" }}>
            {[
              {
                label: "Vault notes",
                value: stats ? String(stats.notes) : "—",
                icon: FileText,
                accent: "#38bdf8",
              },
              {
                label: "Agents on the team",
                value: String(TEAM_MEMBERS.length),
                icon: Users,
                accent: "#7170ff",
              },
              {
                label: "Built-in connections",
                value: String(STACK.length + 4),
                icon: Presentation,
                accent: "#10b981",
              },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <div className="flex items-center gap-2 text-[11px] font-[510] uppercase tracking-[0.06em] text-faint">
                  <s.icon size={12} style={{ color: s.accent }} />
                  {s.label}
                </div>
                <div className="mt-2 text-[26px] font-[510] text-ink tracking-tight">{s.value}</div>
                <div className="mt-1 text-[10.5px] text-faint mono">
                  {s.label === "Vault notes" ? `memory: ${mode}` : "ready"}
                </div>
              </div>
            ))}
          </div>

          {/* local mode banner */}
          <div className="card p-5 mb-10 border-accent/30 bg-accent/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-[15px]">🖥️</div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-[510] text-ink">Zero setup, zero cost — pick your free path</div>
                <p className="text-[12px] text-muted mt-0.5">
                  <b className="text-silver">Guaranteed no-key:</b> install{" "}
                  <span className="mono text-silver">Ollama</span> (ollama.com) → pick{" "}
                  <span className="mono text-silver">"Ollama (local, offline)"</span> in Settings — the team thinks on
                  your machine, works offline, pairs with Home Assistant for real device control.
                  <br />
                  <b className="text-silver">Or a free key (60 sec):</b> NVIDIA build.nvidia.com or OpenRouter free
                  models — both cost $0.
                </p>
              </div>
              <Link href="/settings" className="btn btn-primary ml-auto shrink-0">Set up local mode</Link>
            </div>
          </div>

          {/* agents */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-[510] text-silver">The team</h3>
              <span className="text-[11px] text-faint mono">1 model · 5 roles</span>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {TEAM_MEMBERS.map((a) => (
                <div key={a.role} className="card p-4 hover:bg-white/[0.04] transition-colors">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-[590] text-white mb-3"
                    style={{ background: a.color + "22", color: a.color, border: `1px solid ${a.color}44` }}
                  >
                    {a.label[0]}
                  </div>
                  <div className="text-[12.5px] font-[510] text-ink">{a.label}</div>
                  <div className="mt-1 text-[11px] text-muted leading-snug">{a.blurb}</div>
                </div>
              ))}
            </div>
          </div>

          {/* open-source stack */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-[510] text-silver">Open-source stack — free alternatives to paid apps</h3>
              <span className="text-[11px] text-faint mono">{STACK.length} apps · agents plug in via MCP / HTTP / local</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STACK.map((app) => (
                <div key={app.name} className="card p-4 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-[510] text-ink">{app.name}</span>
                    <span className={`tag mono ${app.access === "mcp" ? "!text-accent2" : app.access === "local" ? "!text-ok" : ""}`}>
                      {app.access}
                    </span>
                    <span className="ml-auto text-[10px] text-faint mono">replaces {app.replaces.split(" (")[0]}</span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-muted leading-snug">{app.blurb}</p>
                  <p className="mt-1.5 text-[10.5px] text-faint mono truncate">{app.setup}</p>
                </div>
              ))}
            </div>
          </div>

          {/* recent notes + quick gym */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-[510] text-silver">Recent memory</h3>
                <Link href="/vault" className="text-[11.5px] text-accent2 hover:text-accent3">
                  open vault →
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="text-[12px] text-faint">The vault is empty — the team starts remembering on first use.</p>
              ) : (
                <ul className="space-y-2">
                  {recent.map((n) => (
                    <li key={n.path}>
                      <Link href={`/vault?note=${encodeURIComponent(n.path)}`} className="group flex items-center gap-2 text-[12.5px]">
                        <FileText size={12} className="text-faint group-hover:text-accent2" />
                        <span className="text-muted group-hover:text-silver mono">{n.path}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-[510] text-silver">Office Studio</h3>
                <Link href="/office" className="text-[11.5px] text-accent2 hover:text-accent3">
                  open →
                </Link>
              </div>
              <ul className="space-y-2">
                {[
                  ["pptx", "Pitch deck from one line of idea"],
                  ["docx", "Proposal or report — typed, not written"],
                  ["xlsx", "Budget tracker with formulas-ready rows"],
                ].map(([ext, desc]) => (
                  <li key={ext} className="flex items-center gap-2 text-[12.5px]">
                    <span className="tag mono">{ext}</span>
                    <span className="text-muted">{desc}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10.5px] text-faint">Editable in PowerPoint / Word / Excel — free, no key needed.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
