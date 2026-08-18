"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  BookOpen,
  Settings,
  Boxes,
  ChevronDown,
  Video,
  Plane,
  Presentation,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "Workspace", icon: MessagesSquare },
  { href: "/vault", label: "Vault", icon: BookOpen },
  { href: "/office", label: "Office Studio", icon: Presentation },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/travel", label: "Travel", icon: Plane },
];

const AGENTS = [
  { name: "Orchestrator", status: "online", color: "#7170ff" },
  { name: "Researcher", status: "idle", color: "#10b981" },
  { name: "Writer", status: "idle", color: "#f59e0b" },
  { name: "Librarian", status: "online", color: "#38bdf8" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 h-full bg-panel border-r border-linesub flex flex-col">
      {/* logo */}
      <Link href="/" className="flex items-center gap-2.5 px-4 h-14 border-b border-linesub shrink-0">
        <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center logo-glow">
          <Boxes size={14} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-[510] text-ink tracking-tight">Agent Vault</div>
          <div className="text-[10px] text-faint mt-0.5">memory-first agents</div>
        </div>
      </Link>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-[510] transition-colors ${
                active
                  ? "bg-white/[0.06] text-ink"
                  : "text-muted hover:text-silver hover:bg-white/[0.03]"
              }`}
            >
              <Icon size={15} strokeWidth={2} className={active ? "text-accent2" : ""} />
              {item.label}
            </Link>
          );
        })}

        {/* agent roster */}
        <div className="pt-6 pb-2 px-2.5">
          <div className="flex items-center justify-between text-[10px] font-[510] uppercase tracking-[0.08em] text-faint">
            <span>Agents</span>
            <ChevronDown size={11} />
          </div>
        </div>
        {AGENTS.map((a) => (
          <div key={a.name} className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-md hover:bg-white/[0.03]">
            <span
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: a.color, boxShadow: `0 0 6px ${a.color}66` }}
            />
            <span className="text-[12.5px] text-silver">{a.name}</span>
            <span className="ml-auto text-[10px] text-faint mono">{a.status}</span>
          </div>
        ))}
      </nav>

      {/* bottom */}
      <div className="border-t border-linesub p-3">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-[510] transition-colors ${
            pathname === "/settings"
              ? "bg-white/[0.06] text-ink"
              : "text-muted hover:text-silver hover:bg-white/[0.03]"
          }`}
        >
          <Settings size={15} strokeWidth={2} />
          Settings
        </Link>
        <div className="mt-3 px-2.5 text-[10.5px] leading-relaxed text-faint">
          Memory = <span className="text-muted">markdown vault</span>
          <br />
          Open it in Obsidian — free.
        </div>
      </div>
    </aside>
  );
}
