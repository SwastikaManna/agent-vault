// Gym runner — evaluates an LLM agent against a task in a tool environment.
// Loop: model picks a tool → env applies it → state checked against ground truth.
// Produces a full trace (tau-bench style action graph, simplified).

import { completeWithTools, type ChatMsg, type LLMConfig, type ToolCall } from "@/lib/llm";
import { GYM_ENVS } from "./envs";
import { getTask, type GymTask } from "./tasks";

export interface GymEvent {
  type: "start" | "tool" | "agent" | "result";
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
}

const MAX_STEPS = 12;

export async function runGymTask(
  cfg: LLMConfig,
  taskId: string,
  onEvent: (e: GymEvent) => void
): Promise<void> {
  try {
    const task: GymTask | undefined = getTask(taskId);
    if (!task) {
      onEvent({ type: "result", error: `Unknown task: ${taskId}` });
      return;
    }
    const env = GYM_ENVS[task.env];
    if (!env) {
      onEvent({ type: "result", error: `Unknown environment: ${task.env}` });
      return;
    }

    const state = env.reset();
    onEvent({ type: "start", message: `Environment "${env.label}" reset.` });

    const tools = env.tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const messages: ChatMsg[] = [
      {
        role: "system",
        content: `You are an agent operating in the "${env.label}" environment. You have these tools:
${env.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Current state:
${JSON.stringify(state, null, 2)}

Complete the user's request using the tools. When done, reply with a plain-text summary of what you did.`,
      },
      { role: "user", content: task.instruction },
    ];

    let steps = 0;
    while (steps < MAX_STEPS) {
      steps++;
      onEvent({ type: "agent", iteration: steps, message: `Step ${steps}: agent deciding…` });

      const { toolCalls, content } = await completeWithTools(cfg, messages, tools, {
        maxTokens: 1024,
      });

      if (toolCalls.length === 0) {
        onEvent({ type: "agent", iteration: steps, message: content || "Agent finished (no tool call)." });
        break;
      }

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = { raw: tc.function.arguments };
        }

        const outcome = env.apply(tc.function.name, args);
        onEvent({
          type: "tool",
          iteration: steps,
          tool: tc.function.name,
          args,
          result: outcome.result,
          state: String(outcome.state[Object.keys(outcome.state)[0]] ?? ""),
        });

        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [tc as ToolCall],
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: outcome.result,
        });

        const check = task.check(outcome.state);
        if (check.passed) {
          onEvent({
            type: "result",
            success: true,
            detail: check.detail,
            iterations: steps,
          });
          return;
        }
      }
    }

    // exhausted steps — final check on last known state
    const probe = env.tools.find((t) => t.name === "list_events") ? "list_events" : "list_devices";
    const lastOutcome = env.apply(probe, {});
    const check = task.check(lastOutcome.state);
    onEvent({
      type: "result",
      success: check.passed,
      detail: check.detail,
      iterations: steps,
      error: check.passed ? undefined : "Step limit reached without satisfying the goal.",
    });
  } catch (e) {
    onEvent({ type: "result", error: (e as Error).message });
  }
}
