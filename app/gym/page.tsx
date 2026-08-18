"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, CheckCircle2, XCircle, Loader2, Wrench } from "lucide-react";
import TopBar from "@/components/topbar";
import { consumeSSE } from "@/lib/client/sse";
import { loadSettings } from "@/lib/client/settings";
import { GYM_TASKS } from "@/lib/gym/tasks";

interface Step {
  iteration: number;
  tool: string;
  args: unknown;
  result: string;
  state?: string;
}

export default function Gym() {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<{ success?: boolean; detail?: string; iterations?: number; error?: string } | null>(null);
  const [message, setMessage] = useState("");

  async function runTask(taskId: string) {
    const s = loadSettings();
    if (!s.apiKey) {
      window.location.href = "/settings";
      return;
    }
    setRunningId(taskId);
    setSteps([]);
    setResult(null);
    setMessage("");

    try {
      await consumeSSE(
        "/api/gym",
        { provider: s.provider, apiKey: s.apiKey, model: s.model, taskId },
        (e: {
          type: string;
          iteration?: number;
          tool?: string;
          args?: unknown;
          result?: string;
          state?: string;
          message?: string;
          success?: boolean;
          detail?: string;
          iterations?: number;
          error?: string;
        }) => {
          if (e.type === "tool") {
            setSteps((prev) => [
              ...prev,
              { iteration: e.iteration ?? 0, tool: e.tool ?? "", args: e.args ?? {}, result: e.result ?? "", state: e.state },
            ]);
          } else if (e.type === "start") {
            setMessage(e.message ?? "");
          } else if (e.type === "agent") {
            setMessage(e.message ?? "");
          } else if (e.type === "result") {
            setResult({ success: e.success, detail: e.detail, iterations: e.iterations, error: e.error });
          }
        }
      );
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setRunningId(null);
    }
  }

  return (
    <>
      <TopBar
        title="Task Gym"
        subtitle="tau-bench-style evaluation: agents work real tool environments, scored on final state"
        right={
          <span className="pill">
            <span className="w-[6px] h-[6px] rounded-full bg-ok" />
            state-based scoring
          </span>
        }
      />

      <div className="flex-1 min-h-0 flex">
        {/* task list */}
        <aside className="w-80 shrink-0 border-r border-linesub overflow-y-auto py-3 px-3 space-y-2">
          {GYM_TASKS.map((t) => (
            <div key={t.id} className="card p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="tag mono">{t.env === "calendar" ? "CAL" : "HOME"}</span>
                <span
                  className={`tag ${t.difficulty === "easy" ? "!text-ok" : t.difficulty === "medium" ? "!text-warn" : "!text-danger"}`}
                >
                  {t.difficulty}
                </span>
              </div>
              <div className="text-[13px] font-[510] text-ink leading-snug">{t.title}</div>
              <p className="mt-1 text-[11.5px] text-muted leading-snug line-clamp-3">{t.instruction}</p>
              <button
                className="btn mt-3 w-full justify-center !py-1.5"
                onClick={() => void runTask(t.id)}
                disabled={runningId !== null}
              >
                {runningId === t.id ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Running…
                  </>
                ) : (
                  <>
                    <Play size={12} /> Run agent
                  </>
                )}
              </button>
            </div>
          ))}
        </aside>

        {/* trace */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-8 py-6">
            {!result && steps.length === 0 && !runningId && (
              <div className="pt-16 text-center">
                <div className="text-[15px] text-muted">Pick a task to run an agent against it.</div>
                <p className="mt-2 text-[12px] text-faint max-w-[420px] mx-auto leading-relaxed">
                  The environment starts in a seeded state. The agent calls tools, each call mutates
                  state, and the final state is checked against the task&apos;s ground truth — the
                  same evaluation pattern as the Amazon tau-bench workstream.
                </p>
              </div>
            )}

            {runningId && steps.length === 0 && (
              <div className="flex items-center gap-2 text-[12px] text-faint mono">
                <Loader2 size={12} className="animate-spin text-accent2" />
                {message || "resetting environment…"}
              </div>
            )}

            {steps.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-[510] uppercase tracking-[0.08em] text-faint mb-3">Action trace</div>
                {steps.map((s, i) => (
                  <div key={i} className="card p-3">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-faint mono">#{s.iteration}</span>
                      <Wrench size={11} className="text-accent2" />
                      <span className="mono text-silver font-[510]">{s.tool}</span>
                      <span className="text-[11px] text-faint truncate">
                        {typeof s.args === "object" && s.args !== null
                          ? Object.entries(s.args as Record<string, unknown>)
                              .map(([k, v]) => `${k}=${String(v).slice(0, 46)}`)
                              .join("  ")
                          : String(s.args)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11.5px] mono text-muted">{s.result}</div>
                    {s.state && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[10.5px] mono text-faint hover:text-silver">state</summary>
                        <pre className="mt-1.5 text-[10.5px] mono text-faint bg-panel border border-linesub rounded p-2 whitespace-pre-wrap">
                          {s.state}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className={`card p-4 mt-4 ${result.success ? "!border-ok/40" : "!border-danger/40"}`}>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 size={16} className="text-ok" />
                  ) : (
                    <XCircle size={16} className="text-danger" />
                  )}
                  <span className={`text-[13px] font-[510] ${result.success ? "text-ok" : "text-danger"}`}>
                    {result.success ? "Task completed" : "Task not completed"}
                  </span>
                  {typeof result.iterations === "number" && (
                    <span className="ml-auto text-[11px] text-faint mono">{result.iterations} iterations</span>
                  )}
                </div>
                {result.error && <p className="mt-2 text-[11.5px] text-warn mono">{result.error}</p>}
                {result.detail && (
                  <pre className="mt-2 text-[11px] mono text-muted bg-panel border border-linesub rounded p-2.5 whitespace-pre-wrap">
                    {result.detail}
                  </pre>
                )}
                <p className="mt-3 text-[10.5px] text-faint">
                  Ground-truth check against final environment state — a recordable result only when the state matches
                  every expected condition.
                </p>
              </div>
            )}

            {!runningId && steps.length > 0 && !result && (
              <p className="mt-4 text-[11px] text-faint">Run finished without a tool loop. Pick another task.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
