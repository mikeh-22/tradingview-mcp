import { fetchGet, fetchPost } from "./client.js";
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
  symbol: string;
  resolution: string;
  name: string | null;
  message: string;
  condition: AlertCondition;
  conditions: AlertCondition[];
  expiration: string;
  auto_deactivate: boolean;
  active: boolean;
  email: boolean;
  mobile_push: boolean;
  popup: boolean;
  web_hook: string | null;
  create_time: string;
  last_fire_time: string | null;
  type: string;
  complexity: string;
}

interface AlertsListResponse {
  s: string;
  r: AlertRecord[] | null;
  errmsg?: string;
}

interface AlertCreateResponse {
  s: string;
  r: AlertRecord | null;
  errmsg?: string;
  err?: { code: string };
}

function mapRecord(r: AlertRecord): Alert {
  // Extract a human-readable price from the condition series if present
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

/**
 * Create a price-crossing alert.
 *
 * TradingView uses its own proprietary alert condition format. The parameters
 * here map to the most common use case: price crossing a value.
 *
 * Frequencies: "on_first_fire" (once), "everytime"
 * Resolution: "1" (1 min), "5", "15", "60", "240", "1D", "1W", "1M"
 */
export async function createAlert(params: {
  symbol: string;
  price: number;
  name?: string;
  message?: string;
  resolution?: string;
  frequency?: string;
  expiration?: string;
  email?: boolean;
  mobile_push?: boolean;
  popup?: boolean;
}): Promise<Alert> {
  const resolution = params.resolution ?? "1D";
  const frequency = params.frequency ?? "on_first_fire";

  const body = {
    symbol: `={"symbol":${JSON.stringify(params.symbol)},"adjustment":"splits","currency-id":"USD"}`,
    resolution,
    message: params.message ?? params.name ?? `${params.symbol} crossing ${params.price}`,
    email: params.email ?? false,
    mobile_push: params.mobile_push ?? true,
    popup: params.popup ?? true,
    web_hook: null,
    ...(params.expiration ? { expiration: params.expiration } : {}),
    conditions: [
      {
        type: "cross",
        frequency,
        series: [{ type: "barset" }, { type: "value", value: params.price }],
        cross_interval: true,
        resolution,
      },
    ],
  };

  const data = await fetchPost<AlertCreateResponse>(`${ALERTS_BASE}/create_alert`, body);
  if (data.s !== "ok" || !data.r) {
    throw new Error(
      `Failed to create alert: ${data.errmsg ?? JSON.stringify(data.err)}. ` +
      `Note: Alert creation may require a chart context in the TradingView UI.`
    );
  }
  return mapRecord(data.r);
}

export async function deleteAlert(id: string): Promise<void> {
  // TradingView's delete endpoint has not been publicly documented.
  // As a workaround, alerts auto-expire. This function throws with guidance.
  throw new Error(
    `Alert deletion via API is not supported. Alert ID: ${id}\n` +
    `To delete alerts, use the TradingView chart UI or let them expire.`
  );
}

export async function setAlertActive(id: string, active: boolean): Promise<void> {
  // Active toggle endpoint not yet discovered.
  throw new Error(
    `Alert ${active ? "enable" : "disable"} via API is not supported. ` +
    `Use the TradingView chart UI to manage alert state.`
  );
}
