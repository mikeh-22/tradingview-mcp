import { tvGet, tvPost, tvPut, tvDelete } from "./client.js";
import type { Alert } from "./types.js";

interface AlertsResponse {
  alerts: Alert[];
}

export async function listAlerts(): Promise<Alert[]> {
  const data = await tvGet<AlertsResponse>("/api/v2/alerts/");
  return data.alerts ?? [];
}

export async function getAlert(id: string): Promise<Alert> {
  return await tvGet<Alert>(`/api/v2/alerts/${id}/`);
}

export async function createAlert(params: {
  symbol: string;
  condition: string;
  price?: number;
  name?: string;
  message?: string;
  expiration?: string;
}): Promise<Alert> {
  return await tvPost<Alert>("/api/v2/alerts/", {
    name: params.name ?? `Alert: ${params.symbol}`,
    symbol: params.symbol,
    condition: params.condition,
    ...(params.price !== undefined ? { price: params.price } : {}),
    ...(params.message ? { message: params.message } : {}),
    ...(params.expiration ? { expiration: params.expiration } : {}),
  });
}

export async function updateAlert(
  id: string,
  params: Partial<{
    name: string;
    price: number;
    message: string;
    expiration: string;
    active: boolean;
  }>
): Promise<Alert> {
  return await tvPut<Alert>(`/api/v2/alerts/${id}/`, params);
}

export async function deleteAlert(id: string): Promise<void> {
  await tvDelete(`/api/v2/alerts/${id}/`);
}

export async function setAlertActive(
  id: string,
  active: boolean
): Promise<Alert> {
  return await tvPut<Alert>(`/api/v2/alerts/${id}/`, { active });
}
