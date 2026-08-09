import { WebSocket } from "ws";
import { getSession } from "./auth.js";
import type { OHLCVBar } from "./types.js";

// TradingView WebSocket protocol for historical OHLCV data.
// Endpoint: prodata.tradingview.com with session-cookie auth in query string.
const WS_BASE = "wss://prodata.tradingview.com/socket.io/websocket";

// Resolution aliases → TradingView resolution strings
const RESOLUTION_MAP: Record<string, string> = {
  "1m": "1", "3m": "3", "5m": "5", "15m": "15", "30m": "30", "45m": "45",
  "1h": "60", "2h": "120", "3h": "180", "4h": "240",
  "1D": "1D", "1W": "1W", "1M": "1M",
  // Pass-through for native TV strings
  "1": "1", "3": "3", "5": "5", "15": "15", "30": "30", "45": "45",
  "60": "60", "120": "120", "180": "180", "240": "240",
  "D": "1D", "W": "1W", "M": "1M",
};

function encode(msg: object): string {
  const json = JSON.stringify(msg);
  return `~m~${json.length}~m~${json}`;
}

function decode(raw: string): unknown[] {
  const messages: unknown[] = [];
  const re = /~m~(\d+)~m~/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const len = parseInt(match[1], 10);
    const start = match.index + match[0].length;
    const content = raw.slice(start, start + len);
    try { messages.push(JSON.parse(content)); } catch { messages.push(content); }
  }
  return messages;
}

function randomId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 14);
}

export async function getOHLCV(
  symbol: string,
  resolution: string,
  options: { countback?: number; from?: number; to?: number; adjustment?: string } = {}
): Promise<OHLCVBar[]> {
  // TradingView corporate-action adjustment mode (DEG-1789).
  // "none" (default) returns raw, unadjusted point-in-time bars — what a trader
  // actually saw on the date (TLRY 2018-09-19 = $214.06, not the merger-adjusted
  // $2140.60). Recent bars are identical to "splits" until a corporate action
  // occurs, so this default is safe for live-data callers and correct for history.
  // Pass adjustment:"splits" for split/merger back-adjusted continuity charts, or
  // "dividends" to also fold dividends in.
  const adjustment = options.adjustment ?? "none";
  const tvResolution = RESOLUTION_MAP[resolution];
  if (!tvResolution) {
    throw new Error(
      `Unknown resolution "${resolution}". Use: 1m 5m 15m 30m 1h 4h 1D 1W 1M`
    );
  }

  const jar = await getSession();

  const countback = options.countback ?? 300;
  const chartSession = randomId("cs_");
  const seriesId = "sds_1";
  const symAlias = "sds_sym_1";

  const now = new Date().toISOString().slice(0, 19);
  const wsUrl = `${WS_BASE}?from=chart%2F&date=${encodeURIComponent(now)}&type=chart`;

  // Build cookie string for WebSocket handshake
  const allCookies = await jar.getCookies("https://www.tradingview.com");
  const cookieHeader = allCookies.map((c) => `${c.key}=${c.value}`).join("; ");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("OHLCV WebSocket timed out after 30s"));
    }, 30_000);

    const ws = new WebSocket(wsUrl, {
      headers: {
        Origin: "https://www.tradingview.com",
        Cookie: cookieHeader,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    const bars: OHLCVBar[] = [];
    let resolved = false;
    let sessionReady = false;

    function done() {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      ws.close();
      // Dedupe (streaming updates re-send bars), sort ascending, and clamp to the
      // requested window — TV honors the range start but streams forward past `to`.
      const byTime = new Map<number, OHLCVBar>();
      for (const b of bars) byTime.set(b.time, b);
      let out = [...byTime.values()].sort((a, b) => a.time - b.time);
      if (options.from) out = out.filter((b) => b.time >= options.from!);
      if (options.to) out = out.filter((b) => b.time <= options.to!);
      resolve(out);
    }

    function setupSession() {
      if (sessionReady) return;
      sessionReady = true;

      ws.send(encode({ m: "set_auth_token", p: ["unauthorized_user_token"] }));
      ws.send(encode({ m: "chart_create_session", p: [chartSession, ""] }));
      ws.send(encode({
        m: "resolve_symbol",
        p: [
          chartSession,
          symAlias,
          `={"adjustment":"${adjustment}","currency-id":"USD","metric":"price","symbol":"${symbol}"}`,
        ],
      }));

      // create_series: [chartSession, seriesId, "s1", symAlias, resolution, countback, range]
      // `range` must be a STRING. "" = latest `countback` bars (live mode).
      // Historical window = the range-string form "r,FROM:TO" (unix seconds) —
      // passing an object here is rejected by TV with "invalid parameters" (DEG-1671).
      const seriesParams: unknown[] = [chartSession, seriesId, "s1", symAlias, tvResolution, countback, ""];
      if (options.from || options.to) {
        const fromTs = options.from ?? (options.to ? options.to - countback * 86400 : Math.floor(Date.now() / 1000) - countback * 86400);
        const toTs = options.to ?? Math.floor(Date.now() / 1000);
        seriesParams[seriesParams.length - 1] = `r,${fromTs}:${toTs}`;
      }
      ws.send(encode({ m: "create_series", p: seriesParams }));
    }

    ws.on("message", (data: Buffer) => {
      const raw = data.toString();

      // Respond to heartbeat pings
      if (raw.includes("~h~")) {
        const pingMatch = /~m~\d+~m~(~h~\d+)/.exec(raw);
        if (pingMatch) ws.send(`~m~${pingMatch[1].length}~m~${pingMatch[1]}`);
      }

      const messages = decode(raw);
      for (const msg of messages) {
        if (typeof msg !== "object" || msg === null) continue;
        const m = msg as Record<string, unknown>;

        if (m["session_id"]) setupSession();

        if (m["m"] === "timescale_update" || m["m"] === "du") {
          const payload = (m["p"] as unknown[])?.[1] as Record<string, unknown> | undefined;
          const series = payload?.[seriesId] as Record<string, unknown> | undefined;
          const s = series?.["s"] as Array<{ v: number[] }> | undefined;
          if (s?.length) {
            for (const bar of s) {
              const [time, open, high, low, close, volume] = bar.v;
              bars.push({ time, open, high, low, close, volume });
            }
          }
          if (series?.["ns"]) done();
        }

        if (m["m"] === "series_completed") done();

        if (m["m"] === "critical_error" || m["m"] === "symbol_error") {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`TradingView WS error: ${JSON.stringify(m["p"])}`));
          return;
        }
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
