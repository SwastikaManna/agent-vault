#!/usr/bin/env node
// Meet Notes — join a Google Meet, capture live captions, save meeting notes to the Agent Vault.
//
// Usage:
//   node scripts/meet-notes.mjs "https://meet.google.com/xxx-xxxx-xxx"
//
// Flags:
//   --profile <dir>   persistent Chrome profile (default: ~/.agent-vault-meet) — sign into Google once,
//                     then meetings join automatically without re-login
//   --out <dir>       vault folder to write notes into (default: ./vault/Meetings)
//
// How it works: opens Chromium (Playwright), joins the meeting muted, turns on captions,
// watches the caption DOM, and writes a timestamped transcript note. Ctrl+C ends the meeting
// and saves the note. Notes appear instantly in the Vault tab.

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";

const args = process.argv.slice(2);
const meetUrl = args.find((a) => a.startsWith("http"));
const profile =
  (args.find((a) => a.startsWith("--profile=")) ?? "--profile=" + path.join(os.homedir(), ".agent-vault-meet")).split("=")[1];
const outDir =
  (args.find((a) => a.startsWith("--out=")) ?? "--out=" + path.join(process.cwd(), "vault", "Meetings")).split("=")[1];

if (!meetUrl) {
  console.error("Usage: node scripts/meet-notes.mjs <meet-url> [--profile=dir] [--out=dir]");
  process.exit(1);
}

const CAPTION_SELECTORS = [
  '[jsname="r4nke"]', // classic Meet captions container
  'div[class*="caption"] span',
  'div[role="region"] div[jsname] span[jsname]',
];

async function readCaptions(page) {
  for (const sel of CAPTION_SELECTORS) {
    try {
      const els = await page.locator(sel).all();
      const texts = [];
      for (const el of els.slice(-4)) {
        const t = (await el.textContent())?.trim();
        if (t) texts.push(t);
      }
      if (texts.length) return texts.join(" ");
    } catch {
      // try next selector
    }
  }
  return "";
}

async function enableCaptions(page) {
  // Try the captions button (aria-label), then the keyboard shortcut.
  const btn = page.getByRole("button", { name: /captions|subtitles/i }).first();
  try {
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    await page.keyboard.press("Control+e");
    return true;
  } catch {
    return false;
  }
}

const browser = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 800 },
});
const page = browser.pages()[0] ?? (await browser.newPage());

console.log(`Joining ${meetUrl} (profile: ${profile})…`);
await page.goto(meetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

// mute + no camera
try {
  const muteBtn = page.getByRole("button", { name: /microphone|mic/i }).first();
  if (await muteBtn.isVisible({ timeout: 3000 })) await muteBtn.click();
} catch {}
try {
  const camBtn = page.getByRole("button", { name: /camera|video/i }).first();
  if (await camBtn.isVisible({ timeout: 3000 })) await camBtn.click();
} catch {}

// join the call
try {
  const join = page.getByRole("button", { name: /join now|ask to join/i }).first();
  if (await join.isVisible({ timeout: 4000 })) await join.click();
} catch {}
await page.waitForTimeout(3000);

await enableCaptions(page);
console.log("Captions enabled. Meeting notes will be written to:", outDir, "\nPress Ctrl+C to end and save.");

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "-");
const notePath = path.join(outDir, `${stamp}.md`);
const transcript = [];
let last = "";
let lastFlush = Date.now();

const flush = () => {
  const header = `---\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags: [meeting, notes]\n---\n\n# Meeting — ${stamp}\n\nSource: ${meetUrl}\n\n## Transcript\n\n`;
  fs.writeFileSync(notePath, header + transcript.map((t) => `- ${t}`).join("\n") + "\n", "utf-8");
};

process.on("SIGINT", async () => {
  console.log("\nEnding meeting, saving notes…");
  flush();
  await browser.close();
  console.log("Saved:", notePath);
  process.exit(0);
});

while (true) {
  const cap = await readCaptions(page);
  if (cap && cap !== last) {
    const time = new Date().toTimeString().slice(0, 8);
    transcript.push(`[${time}] ${cap}`);
    last = cap;
    process.stdout.write(`\r${transcript.length} lines captured`);
  }
  if (Date.now() - lastFlush > 30000) {
    flush();
    lastFlush = Date.now();
  }
  await page.waitForTimeout(2000);
}
