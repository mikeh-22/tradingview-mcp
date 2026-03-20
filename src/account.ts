import { tvGet } from "./client.js";
import type { UserAccount } from "./types.js";

interface WatchlistRecord {
  id: number;
  name: string;
  type: string;
  active: boolean;
}

interface NotificationInfo {
  email?: string | null;
  [key: string]: unknown;
}

/**
 * Returns basic account info derived from the active watchlist (which embeds the user ID).
 * TradingView does not expose a dedicated public user profile API endpoint.
 */
export async function getAccount(): Promise<UserAccount & Record<string, unknown>> {
  // The active watchlist's id equals the user's numeric ID
  const active = await tvGet<WatchlistRecord>("/api/v1/symbols_list/active/");
  return {
    id: active.id,
    username: `user_${active.id}`,   // username not available without a profile API
    plan: undefined,
    avatar: undefined,
    profile_url: `https://www.tradingview.com/u/`,
  };
}

export async function getNotificationSettings(): Promise<Record<string, unknown>> {
  return await tvGet<NotificationInfo>("/api/v1/alert/notificationinfo/");
}
