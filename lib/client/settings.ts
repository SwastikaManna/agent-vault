// Client-side settings (BYOK — keys never leave the browser).

export interface AppSettings {
  provider: string;
  apiKey: string;
  model: string;
}

const KEY = "agent-vault-settings";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { provider: "openai", apiKey: "", model: "" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        provider: s.provider || "openai",
        apiKey: s.apiKey || "",
        model: s.model || "",
      };
    }
  } catch {
    // fall through
  }
  return { provider: "openai", apiKey: "", model: "" };
}

export function saveSettings(s: AppSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}
