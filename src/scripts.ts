import { fetchGet } from "./client.js";
import type { PineScript } from "./types.js";

const PINE = "https://pine-facade.tradingview.com/pine-facade";

interface ScriptRecord {
  scriptIdPart: string;
  scriptName: string;
  version: string;
  scriptAccess: string;
  userId?: number;
  extra?: { kind?: string; serverSideOnly?: boolean };
}

interface ScriptSource {
  source: string;
  version: string;
  description: string;
}

interface VersionRecord {
  version: string;
  created: string;
}

function mapRecord(s: ScriptRecord): PineScript {
  return {
    id: s.scriptIdPart,
    name: s.scriptName,
    version: s.version,
  };
}

/**
 * List Pine scripts.
 * filter: "saved" = scripts the user has saved/favorited
 *         "published" = scripts the user has published
 *         "all" = all public scripts in the library (large dataset, use limit)
 */
export async function listScripts(options: {
  filter?: "saved" | "published" | "all";
  limit?: number;
} = {}): Promise<PineScript[]> {
  const filter = options.filter ?? "saved";
  const params = new URLSearchParams({
    filter,
    limit: String(options.limit ?? 100),
  });
  const data = await fetchGet<ScriptRecord[]>(`${PINE}/list?${params}`);
  return (data ?? []).map(mapRecord);
}

export async function getScript(id: string, version?: string): Promise<{
  id: string;
  version: string;
  name: string;
  source: string;
}> {
  // Resolve version if not provided
  let resolvedVersion = version;
  if (!resolvedVersion) {
    const versions = await fetchGet<VersionRecord[]>(`${PINE}/versions/${encodeURIComponent(id)}/last`);
    resolvedVersion = versions?.[0]?.version ?? "1";
  }

  const data = await fetchGet<ScriptSource>(
    `${PINE}/translate/${encodeURIComponent(id)}/${resolvedVersion}`
  );
  return {
    id,
    version: data.version,
    name: data.description,
    source: data.source,
  };
}
