// Open-source stack — free, self-hostable alternatives to paid SaaS apps,
// and how the agent team plugs into each one. Pure data, safe for client use.

export interface StackApp {
  name: string;
  replaces: string;
  category: string;
  access: "mcp" | "http" | "local";
  setup: string;
  blurb: string;
}

export const STACK: StackApp[] = [
  { name: "Ollama", replaces: "ChatGPT API / Claude API (paid tokens)", category: "AI — local models", access: "local", setup: "ollama.com, then pick provider \"Ollama\" in Settings — no key needed", blurb: "The team's offline brain: Llama, Nemotron, Qwen run on your machine, free forever." },
  { name: "n8n", replaces: "Zapier / Make ($$/mo)", category: "Automation", access: "http", setup: "n8n.io — self-host, expose webhook, agents call it via fetch_url", blurb: "500+ node workflows: email, Slack, spreadsheets, APIs — your agent triggers them." },
  { name: "Activepieces", replaces: "Zapier / IFTTT", category: "Automation", access: "http", setup: "activepieces.com, open-source", blurb: "Lightweight workflow automation with an agent-friendly REST API." },
  { name: "Home Assistant", replaces: "SmartThings / Google Home cloud", category: "Smart home", access: "mcp", setup: "home-assistant.io + community MCP server → Settings → MCP", blurb: "Real lights, locks, thermostats. The gym's smart home becomes your actual home — works offline on LAN." },
  { name: "Playwright", replaces: "Browser automation SaaS", category: "Browser", access: "local", setup: "preinstalled — scripts/meet-notes.mjs is one example", blurb: "Full browser control: joins meetings, fills forms, scrapes pages, takes notes." },
  { name: "Open WebUI", replaces: "ChatGPT web / Claude web", category: "AI — interface", access: "http", setup: "openwebui.com, connects to Ollama", blurb: "A polished ChatGPT-style UI for your local models, with RAG built in." },
  { name: "Flowise", replaces: "Langflow / paid RAG builders", category: "AI — workflows", access: "http", setup: "flowiseai.com", blurb: "Visual LLM app builder — agents can call its exported API endpoints." },
  { name: "LocalAI", replaces: "OpenAI API (self-hosted)", category: "AI — local models", access: "local", setup: "localai.io — drop-in OpenAI-compatible server", blurb: "Run the same OpenAI SDK against your own hardware; whisper + embeddings included." },
  { name: "Mattermost", replaces: "Slack / Teams (paid tiers)", category: "Comms", access: "http", setup: "mattermost.com", blurb: "Team chat with bot APIs — the agent can post, read channels, and report." },
  { name: "Rocket.Chat", replaces: "Slack", category: "Comms", access: "http", setup: "rocket.chat", blurb: "Another Slack-grade open chat with strong bot framework." },
  { name: "Chatwoot", replaces: "Intercom / Zendesk ($)", category: "Support", access: "http", setup: "chatwoot.com", blurb: "Shared inbox + chatbot API — agents can draft replies and tag conversations." },
  { name: "Twenty", replaces: "HubSpot / Salesforce (paid)", category: "CRM", access: "http", setup: "twenty.com", blurb: "Modern open CRM; agents read/write contacts and deals via API." },
  { name: "Plane", replaces: "Jira / Linear (paid tiers)", category: "Project mgmt", access: "http", setup: "plane.so", blurb: "Issue tracking & roadmaps; agents create tasks from meetings automatically." },
  { name: "Vikunja", replaces: "Todoist / TickTick", category: "Tasks", access: "http", setup: "vikunja.io", blurb: "Self-hosted to-do lists; agent turns decisions into action items." },
  { name: "NocoDB", replaces: "Airtable (paid)", category: "Databases", access: "http", setup: "nocodb.com", blurb: "Spreadsheet UI over any SQL database — agents query it like a table." },
  { name: "Baserow", replaces: "Airtable", category: "Databases", access: "http", setup: "baserow.io", blurb: "No-code database with REST API for agent automation." },
  { name: "Metabase", replaces: "Looker / Power BI ($)", category: "BI", access: "http", setup: "metabase.com", blurb: "Dashboards & SQL questions; agents pull numbers and cite them." },
  { name: "Penpot", replaces: "Figma (paid tiers)", category: "Design", access: "http", setup: "penpot.app", blurb: "Open design tool; export specs the agent can read as JSON." },
  { name: "Excalidraw", replaces: "Miro / FigJam", category: "Whiteboard", access: "http", setup: "excalidraw.com — self-host option", blurb: "Diagrams as JSON — agents can generate and embed them in vault notes." },
  { name: "Cal.com", replaces: "Calendly ($)", category: "Scheduling", access: "http", setup: "cal.com — open-source", blurb: "Booking links; agent checks availability and proposes meeting slots." },
  { name: "Obsidian", replaces: "Notion / Evernote (paid)", category: "Knowledge", access: "local", setup: "obsidian.md — already wired as the vault", blurb: "Your free memory browser — the vault this whole app is built on." },
];

export const STACK_CATEGORIES = [...new Set(STACK.map((s) => s.category))];
