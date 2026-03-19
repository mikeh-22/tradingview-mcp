import { publicGet, fetchPost } from "./client.js";
import type { Quote, SymbolSearchResult } from "./types.js";

const SCANNER = "https://scanner.tradingview.com";
const SYMBOL_SEARCH = "https://symbol-search.tradingview.com";

const QUOTE_COLUMNS = [
  "open",
  "high",
  "low",
  "close",
  "volume",
  "change",
  "change_abs",
  "market_cap_basic",
  "description",
  "exchange",
  "type",
  "currency_code",
  "update_mode",
  "pricescale",
];

const SYMBOL_INFO_COLUMNS = [
  ...QUOTE_COLUMNS,
  "earnings_per_share_basic_ttm",
  "price_earnings_ttm",
  "dividends_yield",
  "sector",
  "industry",
  "country",
  "fundamental_currency_code",
  "all_time_high",
  "all_time_low",
  "52_week_high",
  "52_week_low",
  "average_volume_10d_calc",
  "average_volume_30d_calc",
  "beta_1_year",
];

interface ScannerSymbolResponse {
  data: Array<{ s: string; d: unknown[] }>;
}

function mapQuote(symbol: string, columns: string[], values: unknown[]): Quote {
  const get = (col: string) => values[columns.indexOf(col)];
  return {
    symbol,
    open: get("open") as number,
    high: get("high") as number,
    low: get("low") as number,
    close: get("close") as number,
    volume: get("volume") as number,
    change: get("change") as number,
    change_abs: get("change_abs") as number,
    market_cap: get("market_cap_basic") as number | undefined,
    description: get("description") as string | undefined,
    exchange: get("exchange") as string | undefined,
    type: get("type") as string | undefined,
  };
}

export async function getQuote(symbols: string[]): Promise<Quote[]> {
  const data = await fetchPost<ScannerSymbolResponse>(`${SCANNER}/symbol`, {
    symbols: { tickers: symbols },
    columns: QUOTE_COLUMNS,
  });
  return (data.data ?? []).map((row) =>
    mapQuote(row.s, QUOTE_COLUMNS, row.d as unknown[])
  );
}

export async function getSymbolInfo(symbol: string): Promise<Record<string, unknown>> {
  const data = await fetchPost<ScannerSymbolResponse>(`${SCANNER}/symbol`, {
    symbols: { tickers: [symbol] },
    columns: SYMBOL_INFO_COLUMNS,
  });
  const row = data.data?.[0];
  if (!row) throw new Error(`Symbol not found: ${symbol}`);
  const result: Record<string, unknown> = { symbol: row.s };
  SYMBOL_INFO_COLUMNS.forEach((col, i) => {
    result[col] = (row.d as unknown[])[i];
  });
  return result;
}

interface SymbolSearchResponse {
  symbols_remaining: number;
  symbols: Array<{
    symbol: string;
    full_name: string;
    description: string;
    exchange: string;
    type: string;
    currency_code?: string;
  }>;
}

export async function searchSymbols(
  query: string,
  options: { exchange?: string; type?: string; limit?: number } = {}
): Promise<SymbolSearchResult[]> {
  const params = new URLSearchParams({
    text: query,
    hl: "1",
    lang: "en",
    domain: "production",
    ...(options.exchange ? { exchange: options.exchange } : {}),
    ...(options.type ? { type: options.type } : {}),
    ...(options.limit ? { limit: String(options.limit) } : { limit: "30" }),
  });
  const data = await publicGet<SymbolSearchResponse>(
    `${SYMBOL_SEARCH}/symbol_search/v3/?${params}`
  );
  return (data.symbols ?? []).map((s) => ({
    symbol: s.symbol,
    full_name: s.full_name,
    description: s.description,
    exchange: s.exchange,
    type: s.type,
    currency_code: s.currency_code,
  }));
}
