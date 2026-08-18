// Vault memory store — Obsidian-compatible markdown vault.
// Dev: local filesystem (the git-tracked /vault folder in this repo).
// Prod (Vercel): GitHub API-backed, so the vault stays a real repo folder
// users can clone and open in Obsidian (free) with Obsidian Git sync.

export interface VaultNode {
  path: string; // relative to vault root, e.g. "Agents/Researcher.md"
  type: "file" | "dir";
  content?: string; // files only
  sha?: string; // github only
}

export interface VaultStats {
  notes: number;
  folders: number;
  lastModified: string;
}

export interface VaultStore {
  list(): Promise<VaultNode[]>;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
  stats(): Promise<VaultStats>;
}

// ---------- local filesystem store ----------
import fs from "fs";
import path from "path";

const VAULT_DIR = process.env.VAULT_DIR || path.join(process.cwd(), "vault");

function safeResolve(rel: string): string {
  const target = path.resolve(VAULT_DIR, rel);
  if (!target.startsWith(path.resolve(VAULT_DIR) + path.sep) && target !== path.resolve(VAULT_DIR)) {
    throw new Error("Path escapes vault root");
  }
  return target;
}

function walk(dir: string, base: string, out: VaultNode[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (entry.isDirectory()) {
      out.push({ path: rel, type: "dir" });
      walk(abs, base, out);
    } else if (entry.name.endsWith(".md")) {
      out.push({ path: rel, type: "file" });
    }
  }
}

class LocalStore implements VaultStore {
  async list(): Promise<VaultNode[]> {
    if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });
    const out: VaultNode[] = [];
    walk(VAULT_DIR, VAULT_DIR, out);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }
  async read(rel: string): Promise<string | null> {
    const abs = safeResolve(rel);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, "utf-8");
  }
  async write(rel: string, content: string): Promise<void> {
    const abs = safeResolve(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }
  async stats(): Promise<VaultStats> {
    const nodes = await this.list();
    const files = nodes.filter((n) => n.type === "file");
    let last = 0;
    for (const f of files) {
      const m = fs.statSync(safeResolve(f.path)).mtimeMs;
      if (m > last) last = m;
    }
    return {
      notes: files.length,
      folders: nodes.filter((n) => n.type === "dir").length,
      lastModified: last ? new Date(last).toISOString() : new Date(0).toISOString(),
    };
  }
}

// ---------- GitHub-backed store (Vercel prod) ----------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const MEMORY_REPO = process.env.MEMORY_REPO || ""; // "owner/repo"

async function gh(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
}

class GitHubStore implements VaultStore {
  private cache: VaultNode[] | null = null;

  async list(): Promise<VaultNode[]> {
    if (this.cache) return this.cache;
    const res = await gh(`/repos/${MEMORY_REPO}/git/trees/main?recursive=1`);
    if (!res.ok) return [];
    const json = await res.json();
    const nodes: VaultNode[] = [];
    const prefix = "vault/";
    for (const item of json.tree ?? []) {
      if (item.type === "tree") continue;
      const p: string = item.path;
      if (!p.startsWith(prefix) || !p.endsWith(".md")) continue;
      nodes.push({ path: p.slice(prefix.length), type: "file", sha: item.sha });
    }
    this.cache = nodes.sort((a, b) => a.path.localeCompare(b.path));
    return this.cache;
  }

  async read(rel: string): Promise<string | null> {
    if (rel.includes("..")) return null;
    const res = await gh(`/repos/${MEMORY_REPO}/contents/vault/${rel}`);
    if (!res.ok) return null;
    const json = await res.json();
    return Buffer.from(json.content, "base64").toString("utf-8");
  }

  async write(rel: string, content: string): Promise<void> {
    if (rel.includes("..")) throw new Error("Invalid path");
    const existing = (await this.list()).find((n) => n.path === rel);
    const body: Record<string, unknown> = {
      message: `Agent Vault: update ${rel}`,
      content: Buffer.from(content, "utf-8").toString("base64"),
    };
    if (existing?.sha) body.sha = existing.sha;
    const res = await gh(`/repos/${MEMORY_REPO}/contents/vault/${rel}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`GitHub write failed (${res.status}): ${err.slice(0, 200)}`);
    }
    this.cache = null;
  }

  async stats(): Promise<VaultStats> {
    const nodes = await this.list();
    const dirs = new Set(nodes.map((n) => n.path.split("/").slice(0, -1).join("/")));
    dirs.delete("");
    return {
      notes: nodes.length,
      folders: dirs.size,
      lastModified: new Date().toISOString(), // repo-level approximation
    };
  }
}

let store: VaultStore | null = null;

export function getStore(): VaultStore {
  if (store) return store;
  store = GITHUB_TOKEN && MEMORY_REPO ? new GitHubStore() : new LocalStore();
  return store;
}

export function storeMode(): "local" | "github" {
  return GITHUB_TOKEN && MEMORY_REPO ? "github" : "local";
}
