# Agent Vault

**A team of AI agents that actually remembers.**

Agent Vault is a multi-agent workspace where a team of specialists — Orchestrator, Researcher,
Writer, Librarian, Critic — works on your tasks, and everything durable is saved as plain
markdown notes in **an Obsidian-compatible vault you own**.

No lock-in. No vendor memory. Your AI team's memory is a folder of `.md` files you can open in
[Obsidian](https://obsidian.md) for free, sync with git, and keep forever.

## What it does

| Feature | Description |
|---|---|
| **Multi-agent team** | One orchestrator routes work to specialist roles; the UI shows who's working and why |
| **Obsidian vault memory** | Agents search the vault before answering, and save durable knowledge as wikilinked markdown notes |
| **Live web research** | Researcher fetches real pages and is honest about what it could and couldn't verify |
| **Task Gym** | tau-bench-style evaluation: run an LLM agent against stateful tool environments (calendar, smart home), scored on final state with a full action trace |
| **BYOK** | Bring your own API key (OpenAI, DeepSeek, OpenRouter, Groq, Gemini) — keys never touch our servers |

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000 → Settings → paste your API key → start working in the Workspace.

The vault lives in `./vault`. Open that folder in Obsidian to browse what the team remembers.

## Memory: local vs GitHub-backed

- **Local dev**: notes are written straight to `./vault` (this repo — commit them whenever you like)
- **Production (Vercel)**: set these env vars and memory becomes a real git repo you can clone:

```
GITHUB_TOKEN=your_pat
MEMORY_REPO=yourname/your-vault-repo   # repo must contain a vault/ folder
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel
```

## Tech

- Next.js (App Router) + TypeScript + Tailwind
- Linear-inspired design system (dark, precise, indigo accent)
- SSE streaming for agent chat and gym traces
- Zero external services required — no database, no auth provider (BYOK means no accounts to manage)

## License

MIT
