import { tvGet, tvPost, tvPostArray, tvDelete } from "./client.js";
import type { Watchlist } from "./types.js";

const BASE = "/api/v1/symbols_list/custom";

interface WatchlistRecord {
  id: number;
  type: string;
  name: string;
  symbols: string[];
  active: boolean;
  shared: boolean;
  color: string | null;
  description: string | null;
  created: string;
  modified: string;
}

function mapRecord(r: WatchlistRecord): Watchlist {
  return {
    id: String(r.id),
    name: r.name,
    symbols: (r.symbols ?? []).filter((s) => !s.startsWith("###")), // strip section headers
  };
}

export async function listWatchlists(): Promise<Watchlist[]> {
  const data = await tvGet<WatchlistRecord[]>(`${BASE}/`);
  return data.map(mapRecord);
}

export async function getWatchlist(id: string): Promise<Watchlist> {
  const data = await tvGet<WatchlistRecord>(`${BASE}/${id}`);
  return mapRecord(data);
}

export async function createWatchlist(
  name: string,
  symbols: string[] = []
): Promise<Watchlist> {
  const data = await tvPost<WatchlistRecord>(`${BASE}/`, { name, symbols });
  return mapRecord(data);
}

export async function renameWatchlist(
  id: string,
  name: string
): Promise<Watchlist> {
  const data = await tvPost<WatchlistRecord>(`${BASE}/${id}/rename/`, { name });
  return mapRecord(data);
}

export async function addSymbols(
  id: string,
  symbols: string[]
): Promise<Watchlist> {
  // Returns the new full symbol list (array of strings)
  const newSymbols = await tvPostArray<string[]>(`${BASE}/${id}/append/`, symbols);
  const wl = await getWatchlist(id);
  return { ...wl, symbols: newSymbols.filter((s) => !s.startsWith("###")) };
}

export async function removeSymbols(
  id: string,
  symbols: string[]
): Promise<Watchlist> {
  // Returns the new full symbol list (array of strings)
  const newSymbols = await tvPostArray<string[]>(`${BASE}/${id}/remove/`, symbols);
  const wl = await getWatchlist(id);
  return { ...wl, symbols: newSymbols.filter((s) => !s.startsWith("###")) };
}

export async function deleteWatchlist(id: string): Promise<void> {
  await tvDelete(`${BASE}/${id}/`);
}
