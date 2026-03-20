import { publicGet } from "./client.js";
import type { Quote } from "./types.js";

const SCANNER = "https://scanner.tradingview.com";

const QUOTE_FIELDS = [
  "open", "high", "low", "close", "volume",
  "change", "change_abs", "market_cap_basic",
  "description", "exchange", "type", "currency_code",
];

const SYMBOL_INFO_FIELDS = [
  ...QUOTE_FIELDS,
  "earnings_per_share_basic_ttm", "price_earnings_ttm",
  "dividends_yield", "sector", "industry", "country",
  "all_time_high", "all_time_low", "52_week_high", "52_week_low",
  "average_volume_10d_calc", "average_volume_30d_calc",
  "beta_1_year", "fundamental_currency_code",
];

// GET /symbol?symbol=EXCHANGE:TICKER&fields=field1,field2,...
// Returns a flat JSON object with field values.
async function fetchSymbolFields(
  symbol: string,
  fields: string[]
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    symbol,
    fields: fields.join(","),
  });
  return publicGet<Record<string, unknown>>(`${SCANNER}/symbol?${params}`);
}

export async function getQuote(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const data = await fetchSymbolFields(symbol, QUOTE_FIELDS);
      return {
        symbol,
        open: data.open as number,
        high: data.high as number,
        low: data.low as number,
        close: data.close as number,
        volume: data.volume as number,
        change: data.change as number,
        change_abs: data.change_abs as number,
        market_cap: data.market_cap_basic as number | undefined,
        description: data.description as string | undefined,
        exchange: data.exchange as string | undefined,
        type: data.type as string | undefined,
      } as Quote;
    })
  );
  return results;
}

export async function getSymbolInfo(symbol: string): Promise<Record<string, unknown>> {
  const data = await fetchSymbolFields(symbol, SYMBOL_INFO_FIELDS);
  return { symbol, ...data };
}

