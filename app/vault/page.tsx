"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Folder, Plus, Pencil, Save, X, CornerDownRight } from "lucide-react";
import TopBar from "@/components/topbar";
import Markdown from "@/components/markdown";

export default function VaultPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[12px] text-faint">Loading vault…</div>}>
      <Vault />
    </Suspense>
  );
}

interface Node {
  path: string;
  type: "file" | "dir";
}

function buildTree(nodes: Node[]): Record<string, { dirs: string[]; files: Node[] }> {
  const tree: Record<string, { dirs: string[]; files: Node[] }> = {};
  for (const n of nodes) {
    const parts = n.path.split("/");
    const dir = parts.slice(0, -1).join("/");
    const key = dir === "" ? "." : dir;
    if (!tree[key]) tree[key] = { dirs: [], files: [] };
    if (n.type === "dir") {
      tree[key].dirs.push(n.path);
    } else {
      tree[key].files.push(n);
    }
  }
  for (const k of Object.keys(tree)) {
    tree[k].dirs.sort();
    tree[k].files.sort((a, b) => a.path.localeCompare(b.path));
  }
  return tree;
}

function Vault() {
  const params = useSearchParams();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [mode, setMode] = useState<string>("local");
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [raw, setRaw] = useState("");
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set(["."]));
  const [newNote, setNewNote] = useState(false);
  const [newPath, setNewPath] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/memory").then((r) => r.json());
      setNodes(j.nodes ?? []);
      setMode(j.mode);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // open note from ?note= param
  useEffect(() => {
    const note = params.get("note");
    if (note) void openNote(note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function openNote(path: string) {
    try {
      const j = await fetch(`/api/memory?path=${encodeURIComponent(path)}`).then((r) => r.json());
      if (j.content !== undefined) {
        setSelected(path);
        setContent(j.content);
        setRaw(j.content);
        setEditing(false);
        setDirty(false);
        const dir = path.split("/").slice(0, -1).join("/") || ".";
        setOpenDirs((prev) => new Set([...prev, dir]));
      }
    } catch {
      // ignore
    }
  }

  function navigateWikilink(name: string) {
    const match = nodes.find((n) => n.type === "file" && n.path.endsWith(`/${name}.md`));
    if (match) {
      void openNote(match.path);
    } else {
      setNewNote(true);
      setNewPath(`${name}.md`);
    }
  }

  async function saveNote() {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected, content: raw }),
      });
      if (res.ok) {
        setContent(raw);
        setDirty(false);
        setEditing(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function createNote() {
    const p = newPath.trim().endsWith(".md") ? newPath.trim() : `${newPath.trim()}.md`;
    if (!p || p.includes("..")) return;
    const body = `---
created: ${new Date().toISOString().slice(0, 10)}
tags: [note]
---

# ${p.replace(".md", "").split("/").pop()}

`;
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p, content: body }),
    });
    if (res.ok) {
      setNewNote(false);
      setNewPath("");
      await load();
      await openNote(p);
    }
  }

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  function renderDir(dir: string, depth: number): React.ReactNode {
    const node = tree[dir];
    if (!node) return null;
    const isOpen = openDirs.has(dir);
    const dirName = dir === "." ? "vault" : dir.split("/").pop()!;
    return (
      <div key={dir}>
        <button
          className="flex items-center gap-1.5 w-full text-left px-2 py-[5px] rounded-md hover:bg-white/[0.03] text-[12.5px] text-silver"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() =>
            setOpenDirs((prev) => {
              const next = new Set(prev);
              if (next.has(dir)) next.delete(dir);
              else next.add(dir);
              return next;
            })
          }
        >
          <Folder size={12} className={isOpen ? "text-accent2" : "text-faint"} />
          <span className="font-[510]">{dirName}</span>
        </button>
        {isOpen && (
          <div>
            {node.files.map((f) => (
              <button
                key={f.path}
                className={`flex items-center gap-1.5 w-full text-left px-2 py-[4px] rounded-md text-[12px] transition-colors ${
                  selected === f.path ? "bg-accent/15 text-ink" : "text-muted hover:text-silver hover:bg-white/[0.03]"
                }`}
                style={{ paddingLeft: 8 + (depth + 1) * 14 }}
                onClick={() => void openNote(f.path)}
              >
                <FileText size={11} className={selected === f.path ? "text-accent2" : "text-faint"} />
                <span className="truncate mono">{f.path.split("/").pop()}</span>
              </button>
            ))}
            {node.dirs.map((d) => renderDir(d, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <TopBar
        title="Vault"
        subtitle={mode === "github" ? "memory synced to GitHub — clone it into Obsidian" : "local vault folder — open it in Obsidian"}
        right={
          <button className="btn" onClick={() => setNewNote(true)}>
            <Plus size={13} /> New note
          </button>
        }
      />

      <div className="flex-1 min-h-0 flex">
        {/* tree */}
        <aside className="w-64 shrink-0 border-r border-linesub overflow-y-auto py-3">
          {newNote && (
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1.5">
                <input
                  className="input !py-1.5 text-[12px] mono"
                  placeholder="Projects/My Note.md"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void createNote()}
                  autoFocus
                />
                <button className="btn btn-primary !px-2.5 !py-1.5" onClick={() => void createNote()}>
                  <Save size={12} />
                </button>
                <button className="btn !px-2.5 !py-1.5" onClick={() => setNewNote(false)}>
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
          {renderDir(".", 0)}
        </aside>

        {/* note view */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-2 px-6 pt-4 pb-2 shrink-0">
                <span className="text-[12px] mono text-muted">{selected}</span>
                <div className="ml-auto flex items-center gap-2">
                  {dirty && !editing && (
                    <button className="btn btn-primary !py-1.5" onClick={saveNote} disabled={saving}>
                      <Save size={12} /> Save
                    </button>
                  )}
                  {!editing ? (
                    <button className="btn !py-1.5" onClick={() => { setRaw(content); setEditing(true); }}>
                      <Pencil size={12} /> Edit
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-primary !py-1.5" onClick={saveNote} disabled={saving || !dirty}>
                        <Save size={12} /> {saving ? "Saving…" : "Save"}
                      </button>
                      <button className="btn !py-1.5" onClick={() => { setRaw(content); setEditing(false); }}>
                        <X size={12} /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-10">
                {editing ? (
                  <textarea
                    className="input mono !text-[13px] min-h-[60vh] leading-relaxed"
                    value={raw}
                    onChange={(e) => { setRaw(e.target.value); setDirty(e.target.value !== content); }}
                  />
                ) : (
                  <div className="max-w-[720px] pt-2">
                    <Markdown text={content} onNavigate={navigateWikilink} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-linesub flex items-center justify-center mb-4">
                <CornerDownRight size={16} className="text-faint" />
              </div>
              <p className="text-[13.5px] text-muted">Select a note from the tree, or let the team save one for you.</p>
              <p className="mt-2 text-[11.5px] text-faint max-w-[380px] leading-relaxed">
                Every note is plain markdown. Point Obsidian at this folder (or clone the repo) and you have a free,
                forever, AI-maintained knowledge base.
              </p>
              <Link href="/workspace" className="btn mt-5">
                Ask the team to write a note
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
