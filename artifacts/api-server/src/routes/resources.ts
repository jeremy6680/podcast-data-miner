import { Router, type IRouter } from "express";
import { db, episodesTable } from "../lib/db";
import { ListResourcesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

type Kind = "book" | "profile" | "article" | "video" | "podcast" | "other";

type Mention = {
  episodeId: string;
  episodeNumber: number | null;
  episodeTitle: string;
  episodePubDate: string;
};

type Aggregated = {
  url: string;
  title: string;
  kind: Kind;
  domain: string | null;
  mentionCount: number;
  firstMentionAt: string;
  lastMentionAt: string;
  themes: string[];
  mentions: Mention[];
};

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // Strip common tracking params
    const stripped = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (k.startsWith("utm_") || k === "ref" || k === "ref_src" || k === "fbclid" || k === "gclid") continue;
      stripped.append(k, v);
    }
    u.search = stripped.toString();
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function domainOf(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const NOISE_DOMAINS = new Set([
  "acast.com",
  "open.acast.com",
  "feeds.acast.com",
  "shows.acast.com",
  "podtrac.com",
  "chartable.com",
  "podscribe.com",
]);

const NOISE_TITLE_PATTERNS = [
  /^acast\.com\/privacy$/i,
  /privacy/i,
  /politique de confidentialit/i,
  /^see acast/i,
  /pour plus d.informations/i,
];

function isNoise(url: string, title: string, domain: string | null): boolean {
  if (domain && NOISE_DOMAINS.has(domain)) return true;
  if (NOISE_TITLE_PATTERNS.some((re) => re.test(title))) return true;
  if (title.trim().length < 2) return true;
  if (/^https?:\/\//i.test(title.trim()) && title.trim().length > 80) return true;
  return false;
}

const GENERIC_TITLES = new Set([
  "ici", "here", "lien", "link", "voir ici", "voir", "site", "site web",
  "website", "click here", "clique ici", "cliquez ici", "more", "plus",
  "linkedin", "twitter", "x", "github", "youtube", "spotify", "instagram",
  "facebook", "tiktok", "medium", "substack", "this article", "cet article",
  "this video", "cette vidéo", "this episode", "cet épisode", "blog", "podcast",
]);

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim().toLowerCase());
}

function deriveTitleFromUrl(url: string, domain: string | null): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (seg) {
      const cleaned = decodeURIComponent(seg)
        .replace(/[-_+]/g, " ")
        .replace(/\.(html?|php|aspx?)$/i, "")
        .trim();
      if (cleaned.length > 2) {
        const titled = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
        return domain ? `${titled} (${domain})` : titled;
      }
    }
  } catch {
    /* fall through */
  }
  return domain ?? url;
}

function pickBestTitle(current: string, candidate: string): string {
  const cGeneric = isGenericTitle(current);
  const candGeneric = isGenericTitle(candidate);
  if (cGeneric && !candGeneric) return candidate;
  if (!cGeneric && candGeneric) return current;
  // both generic or both specific → prefer the longer one
  return candidate.length > current.length ? candidate : current;
}

export interface AggregateResourcesInput {
  q?: string;
  kind?: Kind;
  themes?: string[];
  sortBy?: "mentions" | "recent" | "title";
  limit?: number;
  offset?: number;
}

export async function aggregateResources(input: AggregateResourcesInput) {
  const q = input.q;
  const kind = input.kind;
  const themes = input.themes;
  const sortBy = input.sortBy ?? "mentions";
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const rows = await db.select().from(episodesTable);

  const map = new Map<string, Aggregated>();

  for (const ep of rows) {
    const recs = (ep.recommendations ?? []) as Array<{ title: string; url: string; kind: Kind }>;
    if (recs.length === 0) continue;
    const epPubIso = ep.pubDate.toISOString();
    for (const rec of recs) {
      if (!rec.url || !rec.title) continue;
      const dom = domainOf(rec.url);
      if (isNoise(rec.url, rec.title, dom)) continue;
      const key = normalizeUrl(rec.url);
      const existing = map.get(key);
      if (existing) {
        existing.mentionCount += 1;
        if (epPubIso < existing.firstMentionAt) existing.firstMentionAt = epPubIso;
        if (epPubIso > existing.lastMentionAt) existing.lastMentionAt = epPubIso;
        existing.mentions.push({
          episodeId: ep.id,
          episodeNumber: ep.episodeNumber,
          episodeTitle: ep.title,
          episodePubDate: epPubIso,
        });
        for (const t of ep.themes ?? []) {
          if (!existing.themes.includes(t)) existing.themes.push(t);
        }
        existing.title = pickBestTitle(existing.title, rec.title);
      } else {
        map.set(key, {
          url: rec.url,
          title: rec.title,
          kind: rec.kind,
          domain: dom,
          mentionCount: 1,
          firstMentionAt: epPubIso,
          lastMentionAt: epPubIso,
          themes: [...(ep.themes ?? [])],
          mentions: [{
            episodeId: ep.id,
            episodeNumber: ep.episodeNumber,
            episodeTitle: ep.title,
            episodePubDate: epPubIso,
          }],
        });
      }
    }
  }

  let all = Array.from(map.values());

  // Final pass: if title is still generic, derive from URL/domain
  for (const r of all) {
    if (isGenericTitle(r.title)) {
      r.title = deriveTitleFromUrl(r.url, r.domain);
    }
  }

  // Compute kind counts BEFORE filtering by kind, but AFTER text/theme filters
  let textFilter: ((r: Aggregated) => boolean) | null = null;
  if (q && q.trim().length) {
    const needle = q.trim().toLowerCase();
    textFilter = (r) =>
      r.title.toLowerCase().includes(needle) ||
      (r.domain ? r.domain.toLowerCase().includes(needle) : false);
  }
  let themeFilter: ((r: Aggregated) => boolean) | null = null;
  if (themes && themes.length > 0) {
    const set = new Set(themes);
    themeFilter = (r) => r.themes.some((t) => set.has(t));
  }
  const baseFiltered = all.filter((r) => (!textFilter || textFilter(r)) && (!themeFilter || themeFilter(r)));

  const kindCounts: Record<string, number> = { book: 0, podcast: 0, video: 0, article: 0, profile: 0, other: 0 };
  for (const r of baseFiltered) {
    kindCounts[r.kind] = (kindCounts[r.kind] ?? 0) + 1;
  }

  let filtered = baseFiltered;
  if (kind) filtered = filtered.filter((r) => r.kind === kind);

  // Sort mentions inside each resource (newest first) for stable display
  for (const r of filtered) {
    r.mentions.sort((a, b) => (a.episodePubDate < b.episodePubDate ? 1 : -1));
  }

  const sorted = filtered.sort((a, b) => {
    if (sortBy === "title") return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    if (sortBy === "recent") {
      if (a.lastMentionAt === b.lastMentionAt) return b.mentionCount - a.mentionCount;
      return a.lastMentionAt < b.lastMentionAt ? 1 : -1;
    }
    // mentions (default): most mentions, tiebreak by recency
    if (a.mentionCount !== b.mentionCount) return b.mentionCount - a.mentionCount;
    return a.lastMentionAt < b.lastMentionAt ? 1 : -1;
  });

  const total = sorted.length;
  const items = sorted.slice(offset, offset + limit);

  return { items, total, limit, offset, kindCounts };
}

router.get("/resources", async (req, res) => {
  const parsed = ListResourcesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    return;
  }
  const result = await aggregateResources(parsed.data);
  res.json(result);
});

export default router;
