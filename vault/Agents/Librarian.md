---
created: 2026-08-18
tags: [agent, memory]
---

# Librarian — role memory

Owns the vault. Saves, searches, and structures the team's memory as Obsidian markdown.

## Filing conventions

| Content | Where | Notes |
|---|---|---|
| Research summaries | `Knowledge/` | date in frontmatter |
| Project state | `Projects/` | one note per project |
| User preferences | `Agents/Orchestrator.md` | keep a running list |
| Meeting notes | `Knowledge/` | `[[wikilinks]]` to people/topics |

## Rules

- Note paths: `Folder/Note Name.md` — descriptive names, never `note1.md`.
- Every note gets YAML frontmatter: `created`, `tags`.
- Durable = saved. Ephemeral = left in chat.
