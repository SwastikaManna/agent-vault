// Client-side settings (BYOK — keys never leave the browser).

export interface MCPServerSetting {
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string;
  url?: string;
}

export interface AppSettings {
  provider: string;
  apiKey: string;
  model: string;
  mcpServers: MCPServerSetting[];
  amadeusClientId: string;
  amadeusClientSecret: string;
}

const KEY = "agent-vault-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai",
  apiKey: "",
  model: "",
  mcpServers: [],
  amadeusClientId: "",
  amadeusClientSecret: "",
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        provider: s.provider || "openai",
        apiKey: s.apiKey || "",
        model: s.model || "",
        mcpServers: Array.isArray(s.mcpServers) ? s.mcpServers : [],
        amadeusClientId: s.amadeusClientId || "",
        amadeusClientSecret: s.amadeusClientSecret || "",
      };
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: AppSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}
