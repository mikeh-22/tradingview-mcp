import { publicGet, tvGet } from "./client.js";
import type { NewsItem, Idea } from "./types.js";

const NEWS_BASE = "https://news-headlines.tradingview.com";

interface NewsHeadline {
  id: string;
  title: string;
  published: number;
  source: string;
  urgency: number;
  link: string;
  relatedSymbols?: Array<{ symbol: string }>;
}

interface NewsResponse {
  items: NewsHeadline[];
}

export async function getNews(
  symbol: string,
  count = 20
): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    section: "symbol",
    locale: "en",
    symbol,
    streaming: "false",
    client: "web",
  });
  const data = await publicGet<NewsResponse>(
    `${NEWS_BASE}/v2/view/headlines/symbol?${params}`
  );
  return (data.items ?? []).slice(0, count).map((item) => ({
    id: item.id,
    title: item.title,
    published: item.published,
    source: item.source,
    urgency: item.urgency,
    link: item.link,
    relatedSymbols: item.relatedSymbols?.map((s) => s.symbol),
  }));
}

interface IdeasResponse {
  ideas: Array<{
    id: string;
    name: string;
    author: { username: string };
    symbol: string;
    published_at: number;
    views_count: number;
    likes_count: number;
    chart_url: string;
  }>;
}

export async function searchIdeas(options: {
  symbol?: string;
  query?: string;
  sort?: "recent" | "popular" | "editors_pick";
  page?: number;
}): Promise<Idea[]> {
  const params = new URLSearchParams({
    sort: options.sort ?? "recent",
    page: String(options.page ?? 1),
    ...(options.symbol ? { symbol: options.symbol } : {}),
    ...(options.query ? { filter: options.query } : {}),
  });
  const data = await tvGet<IdeasResponse>(`/api/v1/ideas/?${params}`);
  return (data.ideas ?? []).map((idea) => ({
    id: idea.id,
    title: idea.name,
    author: idea.author?.username ?? "unknown",
    symbol: idea.symbol,
    published: idea.published_at,
    views: idea.views_count,
    likes: idea.likes_count,
    url: idea.chart_url,
  }));
}

export async function getTrendingIdeas(page = 1): Promise<Idea[]> {
  return searchIdeas({ sort: "popular", page });
}
