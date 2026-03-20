import { tvGet } from "./client.js";
import type { Layout } from "./types.js";

interface ChartRecord {
  id: number;
  image_url: string;
  name: string;
  symbol: string;
  short_name: string;
  resolution: string;
  interval: string;
  created: string;
  modified: string;
  created_timestamp: number;
  modified_iso: number;
  url: string;
  favorite: boolean;
  pro_symbol?: string;
  expression?: string;
}

export async function listLayouts(): Promise<Layout[]> {
  const data = await tvGet<ChartRecord[]>("/my-charts/");
  return data.map((c) => ({
    id: String(c.id),
    name: c.name,
    symbol: c.symbol,
    resolution: c.resolution,
    created_at: c.created,
    modified_at: c.modified,
  }));
}

export async function getLayout(id: string): Promise<Layout & Record<string, unknown>> {
  // Fetch full chart list and find by id (no individual chart detail endpoint confirmed)
  const charts = await tvGet<ChartRecord[]>("/my-charts/");
  const chart = charts.find((c) => String(c.id) === id);
  if (!chart) throw new Error(`Layout ${id} not found`);
  return {
    id: String(chart.id),
    name: chart.name,
    symbol: chart.symbol,
    resolution: chart.resolution,
    created_at: chart.created,
    modified_at: chart.modified,
    image_url: chart.image_url,
    chart_url: `https://www.tradingview.com/chart/${chart.url}/`,
    favorite: chart.favorite,
    interval: chart.interval,
  };
}

export async function deleteLayout(_id: string): Promise<void> {
  throw new Error(
    "Chart layout deletion via API is not supported. Use the TradingView web UI to delete layouts."
  );
}
