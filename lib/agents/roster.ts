// Pure roster data — safe to import from client components (no server deps).

export type AgentRole = "orchestrator" | "researcher" | "writer" | "librarian" | "critic";

export const TEAM_MEMBERS: { role: AgentRole; label: string; blurb: string; color: string }[] = [
  { role: "orchestrator", label: "Orchestrator", blurb: "Plans work and assigns specialists.", color: "#7170ff" },
  { role: "researcher", label: "Researcher", blurb: "Fetches live web pages and verifies facts.", color: "#10b981" },
  { role: "writer", label: "Writer", blurb: "Drafts final answers and documents.", color: "#f59e0b" },
  { role: "librarian", label: "Librarian", blurb: "Keeps the Obsidian vault — your memory.", color: "#38bdf8" },
  { role: "critic", label: "Critic", blurb: "Reviews work before it ships.", color: "#f87171" },
];

export const AGENT_COLORS: Record<string, string> = {
  orchestrator: "#7170ff",
  researcher: "#10b981",
  writer: "#f59e0b",
  librarian: "#38bdf8",
  critic: "#f87171",
};
