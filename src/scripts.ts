import { fetchGet } from "./client.js";
import type { PineScript } from "./types.js";

const PINE = "https://pine-facade.tradingview.com/pine-facade";

interface ScriptsResponse {
  results: Array<{
    scriptIdPart: string;
    version: string;
    description: string;
    extra: {
      kind: string;
      serverSideOnly?: boolean;
    };
    modified_time?: number;
  }>;
}

interface ScriptSourceResponse {
  source: string;
  version: string;
  description: string;
}

export async function listScripts(options: {
  orderBy?: "modified_time" | "views_count" | "description";
  limit?: number;
} = {}): Promise<PineScript[]> {
  const params = new URLSearchParams({
    orderby: options.orderBy ? `-${options.orderBy}` : "-modified_time",
    limit: String(options.limit ?? 100),
  });
  const data = await fetchGet<ScriptsResponse>(`${PINE}/list?${params}`);
  return (data.results ?? []).map((s) => ({
    id: s.scriptIdPart,
    name: s.description,
    version: s.version,
    modified_at: s.modified_time
      ? new Date(s.modified_time * 1000).toISOString()
      : undefined,
  }));
}

export async function getScript(id: string, version?: string): Promise<{
  id: string;
  version: string;
  name: string;
  source: string;
}> {
  // If version not provided, fetch the script list to get latest version
  let resolvedVersion = version;
  if (!resolvedVersion) {
    const scripts = await listScripts();
    const found = scripts.find((s) => s.id === id);
    resolvedVersion = found?.version ?? "1";
  }

  const data = await fetchGet<ScriptSourceResponse>(
    `${PINE}/translate/${id}/${resolvedVersion}`
  );
  return {
    id,
    version: data.version,
    name: data.description,
    source: data.source,
  };
}
