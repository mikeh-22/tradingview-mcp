import { WebSocket } from "ws";
import type { OHLCVBar } from "./types.js";

// TradingView WebSocket protocol for historical OHLCV data.
// Docs: unofficial reverse-engineering; endpoints may change.
const WS_URL = "wss://data.tradingview.com/socket.io/websocket";

// Resolution aliases → TradingView resolution strings
const RESOLUTION_MAP: Record<string, string> = {
  "1m": "1", "3m": "3", "5m": "5", "15m": "15", "30m": "30", "45m": "45",
  "1h": "60", "2h": "120", "3h": "180", "4h": "240",
  "1D": "D", "1W": "W", "1M": "M",
  // Pass-through for native TV strings
  "1": "1", "3": "3", "5": "5", "15": "15", "30": "30", "45": "45",
  "60": "60", "120": "120", "180": "180", "240": "240",
  "D": "D", "W": "W", "M": "M",
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
  options: { countback?: number; from?: number; to?: number } = {}
): Promise<OHLCVBar[]> {
  const tvResolution = RESOLUTION_MAP[resolution];
  if (!tvResolution) {
    throw new Error(
      `Unknown resolution "${resolution}". Use: 1m 5m 15m 30m 1h 4h 1D 1W 1M`
    );
  }

  const countback = options.countback ?? 300;
  const chartSession = randomId("cs_");
  const seriesId = "sds_1";
  const symAlias = "sds_sym_1";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("OHLCV WebSocket timed out after 30s"));
    }, 30_000);

    const ws = new WebSocket(
      `${WS_URL}?from=chart&date=${Date.now()}&type=chart`,
      { headers: { Origin: "https://www.tradingview.com" } }
    );

    const bars: OHLCVBar[] = [];
    let resolved = false;

    function done() {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      ws.close();
      resolve(bars);
    }

    ws.on("message", (data: Buffer) => {
      const raw = data.toString();

      // Respond to heartbeat pings
      if (raw.includes("~h~")) {
        const pingMatch = /~m~\d+~m~(~h~\d+)/.exec(raw);
        if (pingMatch) {
          ws.send(`~m~${pingMatch[1].length}~m~${pingMatch[1]}`);
        }
      }

      const messages = decode(raw);
      for (const msg of messages) {
        if (typeof msg !== "object" || msg === null) continue;
        const m = msg as Record<string, unknown>;

        // Connection established — send auth + session setup
        if (m["session_id"]) {
          ws.send(encode({ m: "set_auth_token", p: ["unauthorized_user_token"] }));
          ws.send(encode({ m: "chart_create_session", p: [chartSession, ""] }));
          ws.send(encode({
            m: "resolve_symbol",
            p: [chartSession, symAlias, `={"adjustment":"splits","symbol":"${symbol}"}`],
          }));

          const seriesParams: unknown[] = [chartSession, seriesId, symAlias, tvResolution, countback, ""];
          if (options.from) seriesParams.push({ from: options.from, to: options.to ?? Math.floor(Date.now() / 1000) });

          ws.send(encode({ m: "create_series", p: seriesParams }));
        }

        // Data arrival
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
          // series_completed signals end of data
          if (series?.["ns"]) done();
        }

        if (m["m"] === "series_completed") done();

        // Error handling
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
