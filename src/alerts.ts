import { fetchGet } from "./client.js";
import type { Alert } from "./types.js";

const ALERTS_BASE = "https://pricealerts.tradingview.com";

interface AlertCondition {
  type: string;
  frequency: string;
  series: Array<{ type: string; value?: number }>;
  cross_interval?: boolean;
  resolution?: string;
}

interface AlertRecord {
  alert_id: number;
  name: string | null;
  message: string;
  symbol: string;
  resolution: string;
  condition: AlertCondition;
  expiration: string;
  active: boolean;
  create_time: string;
  last_fire_time: string | null;
}

interface AlertsListResponse {
  s: string;
  r: AlertRecord[] | null;
  errmsg?: string;
}

function mapRecord(r: AlertRecord): Alert {
  const valueSeries = r.condition?.series?.find((s) => s.type === "value");
  return {
    id: String(r.alert_id),
    name: r.name ?? r.message,
    symbol: r.symbol,
    condition: r.condition?.type ?? "unknown",
    price: valueSeries?.value,
    active: r.active,
    expiration: r.expiration,
    message: r.message,
    created_at: r.create_time,
    last_fired_at: r.last_fire_time ?? undefined,
  };
}

export async function listAlerts(): Promise<Alert[]> {
  const data = await fetchGet<AlertsListResponse>(`${ALERTS_BASE}/list_alerts`);
  if (data.s !== "ok") throw new Error(data.errmsg ?? "Failed to list alerts");
  return (data.r ?? []).map(mapRecord);
}

export async function getAlert(id: string): Promise<Alert> {
  const alerts = await listAlerts();
  const alert = alerts.find((a) => a.id === id);
  if (!alert) throw new Error(`Alert ${id} not found`);
  return alert;
}
