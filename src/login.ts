#!/usr/bin/env node
/**
 * Standalone login script — entrypoint for the login container.
 * Runs the Playwright auth flow, saves cookies to the session file, then exits.
 * The session file should be on a shared volume that the MCP server container reads.
 */
import { unlink } from "fs/promises";
import { loginWithPlaywright } from "./auth.js";

async function main() {
  const sessionFile = process.env.TV_SESSION_FILE ?? ".tv_session.json";

  // Always force a fresh login — discard any stale session on the volume
  try {
    await unlink(sessionFile);
    console.error(`[login] Removed existing session file: ${sessionFile}`);
  } catch {
    // File didn't exist — that's fine
  }

  console.error("[login] Starting TradingView login via headless browser...");
  console.error("[login] This may take up to 30 seconds.");

  await loginWithPlaywright();

  console.error(`[login] Done. Session saved to ${sessionFile}`);
  console.error("[login] You can now start the MCP server container.");
}

main().catch((err) => {
  console.error("[login] Failed:", err.message);
  process.exit(1);
});
