import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { CookieJar } from "tough-cookie";
import type { SessionData } from "./types.js";

const SESSION_FILE = process.env.TV_SESSION_FILE ?? ".tv_session.json";
// Re-auth if cookies are older than 25 days
const SESSION_MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000;

export async function saveSession(jar: CookieJar): Promise<void> {
  const cookies = await jar.getCookies("https://www.tradingview.com");
  const data: SessionData = {
    cookies: cookies.map((c) => ({
      key: c.key,
      value: c.value,
      domain: c.domain ?? "tradingview.com",
      path: c.path ?? "/",
      expires: c.expires instanceof Date ? c.expires.toISOString() : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
    })),
    savedAt: new Date().toISOString(),
  };
  await writeFile(SESSION_FILE, JSON.stringify(data, null, 2));
}

export async function loadSession(): Promise<CookieJar | null> {
  if (!existsSync(SESSION_FILE)) return null;

  try {
    const raw = await readFile(SESSION_FILE, "utf-8");
    const data: SessionData = JSON.parse(raw);

    const age = Date.now() - new Date(data.savedAt).getTime();
    if (age > SESSION_MAX_AGE_MS) return null;

    const jar = new CookieJar();
    for (const c of data.cookies) {
      const cookieStr = `${c.key}=${c.value}; Domain=${c.domain}; Path=${c.path}${c.expires ? `; Expires=${c.expires}` : ""}${c.secure ? "; Secure" : ""}${c.httpOnly ? "; HttpOnly" : ""}`;
      await jar.setCookie(cookieStr, "https://www.tradingview.com");
    }
    return jar;
  } catch {
    return null;
  }
}
