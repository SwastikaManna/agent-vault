"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, Terminal, FileText } from "lucide-react";
import TopBar from "@/components/topbar";

export default function Meetings() {
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((j) => {
        setNotes((j.nodes ?? []).filter((n: { path: string; type: string }) => n.type === "file" && n.path.startsWith("Meetings/")).map((n: { path: string }) => n.path));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <TopBar title="Meetings" subtitle="Join a Meet — the team takes the notes for you" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-8 py-10">
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Video size={15} className="text-accent2" />
              <h2 className="text-[15px] font-[510] text-ink">How it works</h2>
            </div>
            <ol className="text-[13px] text-muted space-y-2 leading-relaxed list-decimal pl-5">
              <li>
                Sign into Google once in the meeting profile (first run opens a normal Chrome window):
                <pre className="mono text-[11.5px] bg-panel border border-linesub rounded p-2.5 mt-1.5">{`node scripts/meet-notes.mjs "https://meet.google.com/xxx-xxxx-xxx"`}</pre>
              </li>
              <li>A browser window joins the meeting muted, camera off, captions on</li>
              <li>Captions are captured live; press <span className="mono text-silver">Ctrl+C</span> to end — the transcript is saved as a note</li>
              <li>The note lands in <span className="mono text-silver">vault/Meetings/</span> → appears instantly in the Vault tab → syncs to Obsidian</li>
            </ol>
            <p className="mt-4 text-[11.5px] text-faint">
              Runs locally (Playwright + Chromium) — serverless hosts can't join calls. Flags:{" "}
              <span className="mono">--profile=dir</span> persistent login, <span className="mono">--out=dir</span> vault folder.
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={14} className="text-accent2" />
              <h2 className="text-[13px] font-[510] text-silver">Saved meeting notes</h2>
            </div>
            {notes.length === 0 ? (
              <p className="text-[12px] text-faint">No meetings captured yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {notes.map((n) => (
                  <li key={n}>
                    <Link href={`/vault?note=${encodeURIComponent(n)}`} className="flex items-center gap-2 text-[12.5px] text-muted hover:text-silver">
                      <FileText size={12} className="text-faint" />
                      <span className="mono">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
