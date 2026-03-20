import { fetchGet, fetchPost } from "./client.js";
import type { Drawing } from "./types.js";

const STORAGE = "https://charts-storage.tradingview.com/charts-storage";

interface SourcesResponse {
  sources: Array<{
    id: string;
    type: string;
    points?: unknown[];
    options?: Record<string, unknown>;
    zorder?: number;
    linkKey?: string;
  }>;
  clientId?: string;
  userId?: number;
}

export async function listDrawings(layoutId: string): Promise<Drawing[]> {
  const data = await fetchGet<SourcesResponse>(
    `${STORAGE}/layout/${layoutId}/sources`
  );
  return (data.sources ?? []).map((s) => ({
    id: s.id,
    type: s.type,
    points: s.points,
    options: s.options,
  }));
}

export async function saveDrawing(
  layoutId: string,
  drawing: {
    type: string;
    points?: unknown[];
    options?: Record<string, unknown>;
  }
): Promise<Drawing> {
  const data = await fetchPost<{ source: Drawing }>(
    `${STORAGE}/layout/${layoutId}/sources`,
    drawing
  );
  return data.source;
}

export async function deleteDrawing(
  layoutId: string,
  drawingId: string
): Promise<void> {
  const url = `${STORAGE}/layout/${layoutId}/sources/${drawingId}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`DELETE ${url} → ${res.status} ${res.statusText}`);
  }
}
