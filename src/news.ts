import { publicGet, tvGet } from "./client.js";
import type { NewsItem, Idea } from "./types.js";

const NEWS_BASE = "https://news-mediator.tradingview.com/public/news-flow/v2";

interface NewsRecord {
  id: string;
  title: string;
  published: number;
  urgency: number;
  storyPath: string;
  relatedSymbols?: Array<{ symbol: string }>;
  provider?: { id: string; name: string };
}

interface NewsResponse {
  items: NewsRecord[];
}

export async function getNews(symbol: string, count = 20): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    filter: symbol,
    locale: "en",
    streaming: "false",
    client: "web",
  });
  const data = await publicGet<NewsResponse>(`${NEWS_BASE}/news?${params}`);
  return (data.items ?? []).slice(0, count).map((item) => ({
    id: item.id,
    title: item.title,
    published: item.published,
    source: item.provider?.name ?? item.provider?.id ?? "unknown",
    urgency: item.urgency,
    link: `https://www.tradingview.com${item.storyPath}`,
    relatedSymbols: item.relatedSymbols?.map((s) => s.symbol),
  }));
}

interface IdeasResponse {
  count: number;
  results: Array<{
    id: number;
    name: string;
    user: { username: string };
    symbol: { name: string };
    date_timestamp: number;
    views_count: number;
    likes_count: number;
    chart_url: string;
  }>;
}

export async function searchIdeas(options: {
  symbol?: string;
  query?: string;
  sort?: "recent" | "trending";
  page?: number;
}): Promise<Idea[]> {
  const params = new URLSearchParams({
    sort: options.sort ?? "recent",
    page: String(options.page ?? 1),
    ...(options.symbol ? { symbol: options.symbol } : {}),
    ...(options.query ? { filter: options.query } : {}),
  });
  const data = await tvGet<IdeasResponse>(`/api/v1/ideas/?${params}`);
  return (data.results ?? []).map((idea) => ({
    id: String(idea.id),
    title: idea.name,
    author: idea.user?.username ?? "unknown",
    symbol: idea.symbol?.name ?? "",
    published: idea.date_timestamp,
    views: idea.views_count,
    likes: idea.likes_count,
    url: idea.chart_url,
  }));
}

export async function getTrendingIdeas(page = 1): Promise<Idea[]> {
  return searchIdeas({ sort: "trending", page });
}
