export type StaticRecommendation = {
  title: string;
  url: string;
  kind: "book" | "profile" | "article" | "video" | "podcast" | "other";
};

export type StaticEpisode = {
  id: string;
  podcastSlug: string;
  podcastName: string;
  podcastAuthor: string;
  episodeNumber: number | null;
  title: string;
  summary: string | null;
  descriptionHtml: string;
  descriptionText: string;
  pubDate: string;
  durationSec: number;
  audioUrl: string;
  link: string;
  imageUrl: string;
  language: string;
  themes: string[];
  tools: string[];
  recommendations: StaticRecommendation[];
  chapters: unknown[];
  relatedLinks: unknown[];
};

export type StaticDataCatalog = {
  generatedAt: string;
  episodes: StaticEpisode[];
};

type StaticListResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

type StaticEpisodeSummary = Omit<
  StaticEpisode,
  "descriptionHtml" | "descriptionText" | "recommendations" | "chapters" | "relatedLinks"
>;

type StaticResource = {
  url: string;
  title: string;
  kind: StaticRecommendation["kind"];
  domain: string | null;
  mentionCount: number;
  firstMentionAt: string;
  lastMentionAt: string;
  themes: string[];
  mentions: Array<{
    episodeId: string;
    episodeNumber: number | null;
    episodeTitle: string;
    episodePubDate: string;
  }>;
};

const DEFAULT_LIMIT = 50;

function asUrl(input: RequestInfo | URL): URL {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return new URL(raw, "https://static.local");
}

function toSummary(episode: StaticEpisode): StaticEpisodeSummary {
  const {
    descriptionHtml: _descriptionHtml,
    descriptionText: _descriptionText,
    recommendations: _recommendations,
    chapters: _chapters,
    relatedLinks: _relatedLinks,
    ...summary
  } = episode;
  return summary;
}

function includesAllOrAny(values: string[], selected: string[]): boolean {
  return selected.length === 0 || values.some((value) => selected.includes(value));
}

function getRepeated(search: URLSearchParams, key: string): string[] {
  return search.getAll(key).filter(Boolean);
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function listEpisodes(
  catalog: StaticDataCatalog,
  search: URLSearchParams,
): StaticListResponse<StaticEpisodeSummary> {
  const q = search.get("q")?.trim().toLowerCase() ?? "";
  const themes = getRepeated(search, "themes");
  const tools = getRepeated(search, "tools");
  const podcasts = getRepeated(search, "podcasts");
  const language = search.get("language") ?? "";
  const minDuration = search.get("minDurationSec");
  const maxDuration = search.get("maxDurationSec");
  const sortBy = search.get("sortBy") ?? "pub_date";
  const sortOrder = search.get("sortOrder") ?? "desc";
  const limit = parsePositiveInt(search.get("limit"), DEFAULT_LIMIT);
  const offset = parsePositiveInt(search.get("offset"), 0);

  const filtered = catalog.episodes.filter((episode) => {
    if (episode.title.toLowerCase().includes("redif")) return false;
    if (q) {
      const haystack = [
        episode.podcastName,
        episode.podcastAuthor,
        episode.title,
        episode.summary ?? "",
        episode.descriptionText,
        ...episode.recommendations.map((rec) => rec.title),
      ]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (!includesAllOrAny(episode.themes, themes)) return false;
    if (!includesAllOrAny(episode.tools, tools)) return false;
    if (podcasts.length > 0 && !podcasts.includes(episode.podcastSlug)) return false;
    if (language && episode.language !== language) return false;
    if (minDuration != null && episode.durationSec < Number(minDuration)) return false;
    if (maxDuration != null && episode.durationSec > Number(maxDuration)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    let result: number;
    if (sortBy === "duration") result = a.durationSec - b.durationSec;
    else if (sortBy === "episode_number") result = (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);
    else if (sortBy === "title") result = a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    else result = new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime();
    return sortOrder === "asc" ? result : -result;
  });

  return {
    items: filtered.slice(offset, offset + limit).map(toSummary),
    total: filtered.length,
    limit,
    offset,
  };
}

function listFacet(
  episodes: StaticEpisode[],
  key: "themes" | "tools",
): Array<{ slug: string; name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const episode of episodes) {
    for (const slug of episode[key]) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([slug, count]) => ({ slug, name: slugToLabel(slug), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function domainOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function listResources(
  catalog: StaticDataCatalog,
  search: URLSearchParams,
): StaticListResponse<StaticResource> & { kindCounts: Record<string, number> } {
  const map = new Map<string, StaticResource>();
  for (const episode of catalog.episodes) {
    for (const rec of episode.recommendations) {
      if (!rec.url || !rec.title) continue;
      const key = rec.url.toLowerCase();
      const existing = map.get(key);
      const mention = {
        episodeId: episode.id,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,
        episodePubDate: episode.pubDate,
      };
      if (existing) {
        existing.mentionCount += 1;
        existing.firstMentionAt = existing.firstMentionAt < episode.pubDate ? existing.firstMentionAt : episode.pubDate;
        existing.lastMentionAt = existing.lastMentionAt > episode.pubDate ? existing.lastMentionAt : episode.pubDate;
        existing.mentions.push(mention);
        for (const theme of episode.themes) {
          if (!existing.themes.includes(theme)) existing.themes.push(theme);
        }
      } else {
        map.set(key, {
          url: rec.url,
          title: rec.title,
          kind: rec.kind,
          domain: domainOf(rec.url),
          mentionCount: 1,
          firstMentionAt: episode.pubDate,
          lastMentionAt: episode.pubDate,
          themes: [...episode.themes],
          mentions: [mention],
        });
      }
    }
  }

  const q = search.get("q")?.trim().toLowerCase() ?? "";
  const themes = getRepeated(search, "themes");
  const kind = search.get("kind");
  const sortBy = search.get("sortBy") ?? "mentions";
  const limit = parsePositiveInt(search.get("limit"), DEFAULT_LIMIT);
  const offset = parsePositiveInt(search.get("offset"), 0);

  const baseFiltered = Array.from(map.values()).filter((resource) => {
    if (q && !`${resource.title} ${resource.domain ?? ""}`.toLowerCase().includes(q)) return false;
    if (!includesAllOrAny(resource.themes, themes)) return false;
    return true;
  });

  const kindCounts: Record<string, number> = { book: 0, podcast: 0, video: 0, article: 0, profile: 0, other: 0 };
  for (const resource of baseFiltered) {
    kindCounts[resource.kind] = (kindCounts[resource.kind] ?? 0) + 1;
  }

  const filtered = kind ? baseFiltered.filter((resource) => resource.kind === kind) : baseFiltered;
  filtered.sort((a, b) => {
    if (sortBy === "title") return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    if (sortBy === "recent") return b.lastMentionAt.localeCompare(a.lastMentionAt) || b.mentionCount - a.mentionCount;
    return b.mentionCount - a.mentionCount || b.lastMentionAt.localeCompare(a.lastMentionAt);
  });

  for (const resource of filtered) {
    resource.mentions.sort((a, b) => b.episodePubDate.localeCompare(a.episodePubDate));
  }

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
    kindCounts,
  };
}

export function createStaticApiFetch(
  loadCatalog: () => Promise<StaticDataCatalog>,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<any> {
  return async (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const url = asUrl(input);
    const catalog = await loadCatalog();

    if (url.pathname === "/api/sync" && method === "POST") {
      return {
        state: "done",
        totalEpisodes: catalog.episodes.length,
        processedEpisodes: catalog.episodes.length,
        message: "Catalogue statique genere localement.",
        startedAt: catalog.generatedAt,
        finishedAt: catalog.generatedAt,
      };
    }

    if (method !== "GET" && method !== "HEAD") {
      throw new Error(`Static API does not support ${method} ${url.pathname}`);
    }

    if (url.pathname === "/api/healthz") return { ok: true };
    if (url.pathname === "/api/stats") {
      const lastEpisodeAt = catalog.episodes.reduce<string | null>(
        (latest, episode) => (!latest || episode.pubDate > latest ? episode.pubDate : latest),
        null,
      );
      return {
        totalEpisodes: catalog.episodes.length,
        totalDurationSec: catalog.episodes.reduce((sum, episode) => sum + episode.durationSec, 0),
        themesCount: new Set(catalog.episodes.flatMap((episode) => episode.themes)).size,
        toolsCount: new Set(catalog.episodes.flatMap((episode) => episode.tools)).size,
        podcastsCount: new Set(catalog.episodes.map((episode) => episode.podcastSlug)).size,
        lastSyncAt: catalog.generatedAt,
        lastEpisodeAt,
      };
    }
    if (url.pathname === "/api/episodes") return listEpisodes(catalog, url.searchParams);
    if (url.pathname === "/api/themes") return listFacet(catalog.episodes, "themes");
    if (url.pathname === "/api/tools") return listFacet(catalog.episodes, "tools");
    if (url.pathname === "/api/podcasts") return listPodcasts(catalog.episodes);
    if (url.pathname === "/api/resources") return listResources(catalog, url.searchParams);
    if (url.pathname === "/api/sync/status") {
      return {
        state: "done",
        totalEpisodes: catalog.episodes.length,
        processedEpisodes: catalog.episodes.length,
        message: "Catalogue statique pret.",
        startedAt: catalog.generatedAt,
        finishedAt: catalog.generatedAt,
      };
    }

    const episodeRelatedMatch = url.pathname.match(/^\/api\/episodes\/(.+)\/related$/);
    if (episodeRelatedMatch) {
      const episode = findEpisode(catalog, episodeRelatedMatch[1] ?? "");
      if (!episode) throw new Error("Episode not found");
      const limit = parsePositiveInt(url.searchParams.get("limit"), 6);
      return catalog.episodes
        .filter((candidate) => candidate.id !== episode.id && candidate.themes.some((theme) => episode.themes.includes(theme)))
        .sort((a, b) => b.pubDate.localeCompare(a.pubDate))
        .slice(0, limit)
        .map(toSummary);
    }

    const episodeMatch = url.pathname.match(/^\/api\/episodes\/(.+)$/);
    if (episodeMatch) {
      const episode = findEpisode(catalog, episodeMatch[1] ?? "");
      if (!episode) throw new Error("Episode not found");
      return episode;
    }

    throw new Error(`Static API route not found: ${url.pathname}`);
  };
}

function findEpisode(catalog: StaticDataCatalog, rawId: string): StaticEpisode | undefined {
  const id = decodeURIComponent(rawId);
  return catalog.episodes.find((episode) => episode.id === id);
}

function listPodcasts(episodes: StaticEpisode[]) {
  const map = new Map<string, { slug: string; name: string; author: string; count: number }>();
  for (const episode of episodes) {
    const existing = map.get(episode.podcastSlug);
    if (existing) existing.count += 1;
    else {
      map.set(episode.podcastSlug, {
        slug: episode.podcastSlug,
        name: episode.podcastName,
        author: episode.podcastAuthor,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}
