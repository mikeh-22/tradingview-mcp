export interface Alert {
  id: string;
  name: string;
  symbol: string;
  condition: string;
  price?: number;
  active: boolean;
  expiration?: string;
  message?: string;
  created_at?: string;
  last_fired_at?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface SessionData {
  cookies: SerializedCookie[];
  savedAt: string;
}

export interface SerializedCookie {
  key: string;
  value: string;
  domain: string;
  path: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}
