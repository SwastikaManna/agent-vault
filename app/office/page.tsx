"use client";

import { useState } from "react";
import { Presentation, FileText, Table2, Download, Loader2, Sparkles } from "lucide-react";
import TopBar from "@/components/topbar";
import { loadSettings } from "@/lib/client/settings";

type Kind = "pptx" | "docx" | "xlsx";

const TABS: { kind: Kind; label: string; icon: typeof Presentation }[] = [
  { kind: "pptx", label: "PowerPoint", icon: Presentation },
  { kind: "docx", label: "Word", icon: FileText },
  { kind: "xlsx", label: "Excel", icon: Table2 },
];

export default function Office() {
  const [kind, setKind] = useState<Kind>("pptx");
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!idea.trim()) return;
    setLoading(true);
    setError("");
    const s = loadSettings();
    try {
      const res = await fetch("/api/office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, idea, provider: s.provider, apiKey: s.apiKey, model: s.model }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Generation failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `agent-vault-${stamp}.${kind === "pptx" ? "pptx" : kind === "docx" ? "docx" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar
        title="Office Studio"
        subtitle="Type an idea → get a real, editable PowerPoint / Word / Excel file — free, no key required"
        right={
          <span className="pill">
            <Sparkles size={11} className="text-accent2" /> editable in Microsoft Office / Google Docs
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-8 py-10">
          <div className="card p-6">
            <div className="flex gap-2 mb-5">
              {TABS.map((t) => (
                <button
                  key={t.kind}
                  className={`btn ${kind === t.kind ? "btn-primary" : ""}`}
                  onClick={() => setKind(t.kind)}
                >
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>

            <label className="block text-[11px] font-[510] uppercase tracking-[0.06em] text-faint mb-2">
              Your idea
            </label>
            <textarea
              className="input resize-none min-h-[120px] text-[13.5px] leading-relaxed"
              placeholder={
                kind === "pptx"
                  ? "e.g. A 10-slide pitch deck for a meal-planning app called PlateMate targeting busy professionals…"
                  : kind === "docx"
                    ? "e.g. A one-page project proposal for automating office expense reports with AI…"
                    : "e.g. A weekly budget tracker with categories for rent, groceries, transport, savings…"
              }
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />

            {error && <p className="mt-3 text-[12px] text-warn">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button className="btn btn-primary" onClick={() => void generate()} disabled={loading || !idea.trim()}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {loading ? "Building…" : `Generate ${kind.toUpperCase()}`}
              </button>
              <p className="text-[11px] text-faint">
                Works with the free no-key provider, or any key you add. The file is yours — open, edit, present.
              </p>
            </div>
          </div>

          <div className="card p-6 mt-4">
            <h2 className="text-[13px] font-[510] text-silver mb-2">Microsoft 365 automation — everything in one flow</h2>
            <ul className="text-[12.5px] text-muted space-y-1.5 leading-relaxed">
              <li>• <b className="text-silver">Email:</b> <span className="mono">node scripts/ms365-bridge.mjs email to@x.com "Subject" "Body"</span> — opens Outlook compose, pre-filled, in your logged-in session</li>
              <li>• <b className="text-silver">Calendar:</b> <span className="mono">… calendar "2026-08-20 14:00" "Title" 60m</span> — creates the event in your calendar</li>
              <li>• <b className="text-silver">Docs:</b> <span className="mono">… docs "Name" pptx</span> — opens PowerPoint/Word/Excel Online ready to type</li>
              <li>• <b className="text-silver">Meetings:</b> <span className="mono">scripts/meet-notes.mjs "meet|teams-url"</span> — joins and takes notes (see Meetings tab)</li>
              <li>• <b className="text-silver">Full Graph API:</b> connect Microsoft&apos;s official Graph MCP server (Settings → MCP, one-time <span className="mono">az login</span>) for read/write email, calendar, files from the Workspace itself</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
