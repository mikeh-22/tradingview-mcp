#!/usr/bin/env node
/**
 * Standalone login script.
 *
 * Usage:
 *   node dist/login.js                          # headless (email/password)
 *   node dist/login.js --interactive            # real Chrome browser (Google/Apple/MFA)
 *   node dist/login.js --import-cookies <file>  # import cookies from browser extension export
 */
import { readFile, unlink } from "fs/promises";
import { CookieJar } from "tough-cookie";
import { login, loginInteractive } from "./auth.js";
import { saveSession } from "./session.js";

const args = process.argv.slice(2);
const interactive = args.includes("--interactive");
const importIdx = args.indexOf("--import-cookies");
const importFile = importIdx !== -1 ? args[importIdx + 1] : null;

async function importCookies(filePath: string): Promise<void> {
  console.error(`[login] Importing cookies from ${filePath}...`);
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  // Support both Cookie-Editor format (array of objects) and Netscape format
  const cookies: Array<{ name: string; value: string; domain: string; path: string; expires?: number; secure?: boolean; httpOnly?: boolean }> =
    Array.isArray(parsed) ? parsed : parsed.cookies ?? [];

  const jar = new CookieJar();
  let count = 0;
  for (const c of cookies) {
    if (!String(c.domain ?? "").includes("tradingview.com")) continue;
    const domain = String(c.domain).startsWith(".") ? c.domain : `.${c.domain}`;
    const expires = c.expires && c.expires > 0 ? new Date(c.expires * 1000).toISOString() : undefined;
    const cookieStr =
      `${c.name}=${c.value}; Domain=${domain}; Path=${c.path ?? "/"}` +
      (expires ? `; Expires=${expires}` : "") +
      (c.secure ? "; Secure" : "") +
      (c.httpOnly ? "; HttpOnly" : "");
    try {
      await jar.setCookie(cookieStr, "https://www.tradingview.com");
      count++;
    } catch { /* skip malformed */ }
  }

  if (count === 0) {
    throw new Error("No tradingview.com cookies found in the file. Make sure you exported cookies while on tradingview.com.");
  }

  await saveSession(jar);
  console.error(`[login] Imported ${count} cookies.`);
}

async function main() {
  const sessionFile = process.env.TV_SESSION_FILE ?? ".tv_session.json";

  // Wipe stale session first
  try { await unlink(sessionFile); } catch { /* didn't exist */ }

  if (importFile) {
    await importCookies(importFile);
  } else if (interactive) {
    console.error("[login] Starting interactive login — real Chrome will open...");
    await loginInteractive();
  } else {
    console.error("[login] Starting headless login...");
    console.error("[login] Google/Apple accounts: use --interactive");
    await login();
  }

  console.error(`[login] Session saved to ${sessionFile}`);
  console.error("[login] You can now start the MCP server.");
}

main().catch((err) => {
  console.error("[login] Failed:", err.message);
  process.exit(1);
});
