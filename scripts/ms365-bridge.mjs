#!/usr/bin/env node
// Microsoft 365 bridge — opens Outlook/Calendar/Office apps pre-filled in YOUR
// logged-in browser session (personal or work account). One-time login in the
// profile, then everything is one command. No Azure setup needed.
//
// Usage:
//   node scripts/ms365-bridge.mjs email "to@x.com" "Subject" "Body"
//   node scripts/ms365-bridge.mjs calendar "2026-08-20 14:00" "Title" "60m"
//   node scripts/ms365-bridge.mjs docs "My Name" pptx|docx|xlsx
//   node scripts/ms365-bridge.mjs outlook | calendar | office
//
// Flags: --profile=dir (default ~/.agent-vault-meet — shares login with meet-notes)

import { chromium } from "playwright";
import path from "path";
import os from "os";

const args = process.argv.slice(2);
const cmd = args[0];
const profile = (args.find((a) => a.startsWith("--profile=")) ?? `--profile=${path.join(os.homedir(), ".agent-vault-meet")}`).split("=")[1];

const needsUrl = cmd !== "outlook" && cmd !== "calendar" && cmd !== "office" && cmd !== "docs";
if (!cmd || (needsUrl && args.length < 2)) {
  console.error(`Usage:
  node scripts/ms365-bridge.mjs email "to@x.com" "Subject" "Body"
  node scripts/ms365-bridge.mjs addevent "2026-08-20 14:00" "Title" "60m"
  node scripts/ms365-bridge.mjs docs "Name" pptx|docx|xlsx
  node scripts/ms365-bridge.mjs outlook|calendar|office`);
  process.exit(1);
}

function url() {
  const enc = encodeURIComponent;
  switch (cmd) {
    case "email": {
      const to = enc(args[1] ?? "");
      const subject = enc(args[2] ?? "");
      const body = enc(args.slice(3).join(" ") ?? "");
      return `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`;
    }
    case "addevent": {
      const start = new Date(args[1] ?? Date.now());
      const mins = parseInt(args[3] ?? "60", 10);
      const end = new Date(start.getTime() + mins * 60000);
      const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
      const subject = enc(args[2] ?? "Event");
      return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}&startdt=${iso(start)}&enddt=${iso(end)}`;
    }
    case "docs":
      return { pptx: "https://powerpoint.new", docx: "https://word.new", xlsx: "https://excel.new" }[args[2] ?? "pptx"] ?? "https://office.com";
    case "outlook":
      return "https://outlook.live.com";
    case "calendar":
      return "https://outlook.live.com/calendar";
    case "office":
      return "https://www.office.com";
    default:
      return "https://www.office.com";
  }
}

const browser = await chromium.launchPersistentContext(profile, { headless: false });
const page = browser.pages()[0] ?? (await browser.newPage());
console.log(`Opening: ${url()}`);
await page.goto(url(), { waitUntil: "domcontentloaded", timeout: 60000 });
console.log("Done — complete the action in the browser window (it stays open).");
// keep process alive until user closes the browser window
browser.on("close", () => process.exit(0));
