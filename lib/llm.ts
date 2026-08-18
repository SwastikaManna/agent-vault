// BYOK LLM client — OpenAI-compatible chat completions with streaming and tool calls.
// Works with OpenAI, DeepSeek, OpenRouter, Groq, Gemini (OpenAI-compat endpoint).

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export const PROVIDERS: Record<
  string,
  { label: string; baseUrl: string; defaultModel: string; models: string[] }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    models: [
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3.7-sonnet",
      "openai/gpt-4o",
      "google/gemini-2.0-flash-001",
    ],
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  nvidia: {
    label: "NVIDIA NIM (Nemotron)",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
    models: [
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "nvidia/nemotron-4-340b-instruct",
      "deepseek-ai/deepseek-r1",
      "meta/llama-3.1-405b-instruct",
    ],
  },
  ollama: {
    label: "Ollama (local, offline)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    models: ["llama3.1", "llama3.3", "qwen2.5", "nemotron", "mistral"],
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash"],
  },
};

export function providerBaseUrl(id: string): string {
  return PROVIDERS[id]?.baseUrl ?? id; // custom base URL passthrough
}

/** Stream a chat completion (no tools). Calls onDelta(textChunk) as chunks arrive. */
export async function streamChat(
  cfg: LLMConfig,
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number; onDelta: (d: string) => void }
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${err.slice(0, 300)}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta: string = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          opts.onDelta(delta);
        }
      } catch {
        // ignore malformed keep-alive lines
      }
    }
  }
  return full;
}

/** Non-streaming completion with tool calling. Returns assistant message (may contain tool_calls). */
export async function completeWithTools(
  cfg: LLMConfig,
  messages: ChatMsg[],
  tools: ToolDef[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json();
  const msg = json.choices?.[0]?.message ?? {};
  return {
    content: typeof msg.content === "string" ? msg.content : "",
    toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
  };
}
