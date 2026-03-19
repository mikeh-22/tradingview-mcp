import { tvGet, tvDelete } from "./client.js";
import type { Layout } from "./types.js";

interface LayoutsResponse {
  data: Array<{
    id: string;
    name: string;
    symbol?: string;
    resolution?: string;
    created_at?: string;
    last_modified_time?: string;
  }>;
}

export async function listLayouts(): Promise<Layout[]> {
  const data = await tvGet<LayoutsResponse>("/api/v1/charts/");
  return (data.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    symbol: l.symbol,
    resolution: l.resolution,
    created_at: l.created_at,
    modified_at: l.last_modified_time,
  }));
}

export async function getLayout(id: string): Promise<Record<string, unknown>> {
  return await tvGet<Record<string, unknown>>(`/api/v1/charts/${id}/`);
}

export async function deleteLayout(id: string): Promise<void> {
  await tvDelete(`/api/v1/charts/${id}/`);
}
