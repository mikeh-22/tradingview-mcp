import { CookieJar } from "tough-cookie";
import { getSession } from "./auth.js";

let _jar: CookieJar | null = null;

async function getJar(): Promise<CookieJar> {
  if (!_jar) {
    _jar = await getSession();
  }
  return _jar;
}

export function resetSession(): void {
  _jar = null;
}

async function cookieHeader(jar: CookieJar): Promise<string> {
  const cookies = await jar.getCookies("https://www.tradingview.com");
  return cookies.map((c) => `${c.key}=${c.value}`).join("; ");
}

async function csrfToken(jar: CookieJar): Promise<string | undefined> {
  const cookies = await jar.getCookies("https://www.tradingview.com");
  return cookies.find((c) => c.key === "csrftoken")?.value;
}

async function updateJarFromResponse(
  jar: CookieJar,
  res: Response
): Promise<void> {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) {
    await jar.setCookie(cookie, "https://www.tradingview.com");
  }
}

const BASE = "https://www.tradingview.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// Unauthenticated GET for public endpoints (different subdomains, no cookies needed)
export async function publicGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Authenticated GET/POST for arbitrary full URLs (different subdomains, with cookies)
export async function fetchGet<T>(url: string): Promise<T> {
  const jar = await getJar();
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: BASE,
      Cookie: await cookieHeader(jar),
    },
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function fetchPost<T>(url: string, body: unknown): Promise<T> {
  const jar = await getJar();
  const csrf = await csrfToken(jar);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: BASE,
      Cookie: await cookieHeader(jar),
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`POST ${url} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function tvGet<T>(path: string): Promise<T> {
  const jar = await getJar();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: BASE,
      Cookie: await cookieHeader(jar),
    },
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function tvPost<T>(path: string, body: unknown): Promise<T> {
  const jar = await getJar();
  const csrf = await csrfToken(jar);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: BASE,
      Cookie: await cookieHeader(jar),
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function tvPut<T>(path: string, body: unknown): Promise<T> {
  const jar = await getJar();
  const csrf = await csrfToken(jar);
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: BASE,
      Cookie: await cookieHeader(jar),
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Send a JSON array as the raw body (used by watchlist append/remove endpoints)
export async function tvPostArray<T>(path: string, body: unknown[]): Promise<T> {
  const jar = await getJar();
  const csrf = await csrfToken(jar);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: BASE,
      Cookie: await cookieHeader(jar),
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function tvDelete(path: string): Promise<void> {
  const jar = await getJar();
  const csrf = await csrfToken(jar);
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: {
      "User-Agent": UA,
      Referer: BASE,
      Cookie: await cookieHeader(jar),
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
  });
  await updateJarFromResponse(jar, res);
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status} ${res.statusText}`);
}
