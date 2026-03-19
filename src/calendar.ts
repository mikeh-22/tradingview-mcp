import { publicGet } from "./client.js";
import type { EconomicEvent } from "./types.js";

const CAL_BASE = "https://economic-calendar.tradingview.com";

interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  importance: 0 | 1 | 2;  // 0=low, 1=medium, 2=high
  actual_value?: string;
  forecast_value?: string;
  previous_value?: string;
}

interface CalendarResponse {
  result: CalendarEvent[];
  status: string;
}

const IMPORTANCE_MAP: Record<number, "low" | "medium" | "high"> = {
  0: "low",
  1: "medium",
  2: "high",
};

export async function getEconomicCalendar(options: {
  from?: string;        // ISO 8601 date string, e.g. "2024-01-01"
  to?: string;          // ISO 8601 date string
  countries?: string[]; // e.g. ["US", "EU", "GB"]
  minImpact?: "low" | "medium" | "high";
} = {}): Promise<EconomicEvent[]> {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const from = options.from
    ? new Date(options.from).toISOString()
    : now.toISOString();
  const to = options.to
    ? new Date(options.to).toISOString()
    : weekLater.toISOString();

  const params = new URLSearchParams({ from, to });
  if (options.countries?.length) {
    params.set("countries", options.countries.join(","));
  }

  const data = await publicGet<CalendarResponse>(
    `${CAL_BASE}/events?${params}`
  );

  const impactThreshold =
    options.minImpact === "high" ? 2 : options.minImpact === "medium" ? 1 : 0;

  return (data.result ?? [])
    .filter((e) => e.importance >= impactThreshold)
    .map((e) => ({
      id: e.id,
      title: e.title,
      country: e.country,
      date: e.date,
      impact: IMPORTANCE_MAP[e.importance] ?? "low",
      actual: e.actual_value,
      forecast: e.forecast_value,
      previous: e.previous_value,
    }));
}
