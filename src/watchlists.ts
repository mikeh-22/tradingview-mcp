import { tvGet, tvPost, tvPut, tvDelete } from "./client.js";
import type { Watchlist } from "./types.js";

interface WatchlistsResponse {
  watchlists: Watchlist[];
}

export async function listWatchlists(): Promise<Watchlist[]> {
  const data = await tvGet<WatchlistsResponse>(
    "/api/v1/screener/symbols/watchlists/"
  );
  return data.watchlists ?? [];
}

export async function getWatchlist(id: string): Promise<Watchlist> {
  return await tvGet<Watchlist>(`/api/v1/screener/symbols/watchlists/${id}/`);
}

export async function createWatchlist(
  name: string,
  symbols: string[] = []
): Promise<Watchlist> {
  return await tvPost<Watchlist>("/api/v1/screener/symbols/watchlists/", {
    name,
    symbols,
  });
}

export async function renameWatchlist(
  id: string,
  name: string
): Promise<Watchlist> {
  return await tvPut<Watchlist>(
    `/api/v1/screener/symbols/watchlists/${id}/`,
    { name }
  );
}

export async function addSymbols(
  id: string,
  symbols: string[]
): Promise<Watchlist> {
  return await tvPut<Watchlist>(
    `/api/v1/screener/symbols/watchlists/${id}/symbols/`,
    { symbols, operation: "add" }
  );
}

export async function removeSymbols(
  id: string,
  symbols: string[]
): Promise<Watchlist> {
  return await tvPut<Watchlist>(
    `/api/v1/screener/symbols/watchlists/${id}/symbols/`,
    { symbols, operation: "remove" }
  );
}

export async function deleteWatchlist(id: string): Promise<void> {
  await tvDelete(`/api/v1/screener/symbols/watchlists/${id}/`);
}
