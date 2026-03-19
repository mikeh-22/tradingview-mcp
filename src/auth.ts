import { chromium } from "playwright";
import { CookieJar } from "tough-cookie";
import { saveSession, loadSession } from "./session.js";

// When running inside Docker, Chromium requires --no-sandbox
const isDocker = process.env.DOCKER === "1";

export async function getSession(): Promise<CookieJar> {
  const existing = await loadSession();
  if (existing) {
    console.error("[auth] Loaded existing session from disk");
    return existing;
  }

  if (isDocker) {
    const sessionFile = process.env.TV_SESSION_FILE ?? ".tv_session.json";
    throw new Error(
      `No valid session found. Run the login container first:\n\n` +
      `  docker run --rm -it \\\n` +
      `    -v tradingview-mcp-session:/data \\\n` +
      `    -e TV_USERNAME=<your_username> \\\n` +
      `    -e TV_PASSWORD=<your_password> \\\n` +
      `    ${process.env.IMAGE_NAME ?? "tradingview-mcp"}:login\n\n` +
      `Then mount the same volume when starting the server so it can read ${sessionFile}.`
    );
  }

  console.error("[auth] No valid session found, logging in via browser...");
  return await loginWithPlaywright();
}

export async function loginWithPlaywright(): Promise<CookieJar> {
  const username = process.env.TV_USERNAME;
  const password = process.env.TV_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "TV_USERNAME and TV_PASSWORD environment variables are required"
    );
  }

  const args = isDocker ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];
  const browser = await chromium.launch({ headless: true, args });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.error("[auth] Navigating to TradingView...");
    await page.goto("https://www.tradingview.com/");

    // Click the sign-in button
    await page.click('[data-name="header-user-menu-sign-in"]');
    await page.waitForSelector('[data-name="login-page-email-button"]', {
      timeout: 10000,
    });

    // Choose email sign-in
    await page.click('[data-name="login-page-email-button"]');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for successful login (user menu appears)
    await page.waitForSelector('[data-name="header-user-menu-button"]', {
      timeout: 30000,
    });

    console.error("[auth] Login successful");

    const playwrightCookies = await context.cookies();
    const jar = new CookieJar();

    for (const c of playwrightCookies) {
      if (!c.domain.includes("tradingview.com")) continue;
      const domain = c.domain.startsWith(".") ? c.domain : `.${c.domain}`;
      const cookieStr = `${c.name}=${c.value}; Domain=${domain}; Path=${c.path}${c.expires > 0 ? `; Expires=${new Date(c.expires * 1000).toISOString()}` : ""}${c.secure ? "; Secure" : ""}${c.httpOnly ? "; HttpOnly" : ""}`;
      await jar.setCookie(cookieStr, "https://www.tradingview.com");
    }

    await saveSession(jar);
    return jar;
  } finally {
    await browser.close();
  }
}
