import { Router, type IRouter } from "express";
import { db, episodesTable } from "../lib/db";
import { ListResourcesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function normalizeArrayQuery(
  query: typeof import("express").request.query,
  keys: string[],
) {
  const normalized = { ...query };
  for (const key of keys) {
    const value = normalized[key];
    if (typeof value === "string") {
      normalized[key] = [value];
    }
  }
  return normalized;
}

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
    const host = u.hostname.replace(/^www\./, "");
    return host || null;
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
  if (/^mailto:/i.test(url.trim())) return true;
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
  "subscribe", "subscription", "abonnez-vous", "s'abonner", "newsletter",
  "amazon", "fr", "chaîne youtube", "chaine youtube", "la chaîne youtube",
  "la chaine youtube", "youtube channel", "channel",
]);

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim().toLowerCase());
}

const SHORTENER_DOMAINS = new Set([
  "bit.ly",
  "buff.ly",
  "cutt.ly",
  "goo.gl",
  "lnkd.in",
  "ow.ly",
  "rebrand.ly",
  "t.co",
  "tinyurl.com",
]);

const KIND_FALLBACK_LABELS: Record<Kind, string> = {
  book: "Livre mentionné",
  profile: "Profil mentionné",
  article: "Article mentionné",
  video: "Vidéo mentionnée",
  podcast: "Podcast mentionné",
  other: "Lien mentionné",
};

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function stripEpisodePrefix(title: string): string {
  return title.replace(/^#?\d+\s*[-–—:]\s*/, "").trim();
}

function latestMentionTitle(mentions: Mention[]): string | null {
  const latest = mentions.reduce<Mention | null>((acc, mention) => {
    if (!acc || mention.episodePubDate > acc.episodePubDate) return mention;
    return acc;
  }, null);
  return latest ? stripEpisodePrefix(latest.episodeTitle) : null;
}

function readableDomainName(domain: string): string {
  const parts = domain.replace(/^www\./, "").split(".");
  const base = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  if (!base) return domain;
  return titleCaseWords(base.replace(/[-_+]/g, " "));
}

function cleanPathSegment(segment: string): string {
  return titleCaseWords(
    decodeURIComponent(segment)
      .replace(/\.(html?|php|aspx?|pdf)$/i, "")
      .replace(/[-_+]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeComparableTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isUrlLikeTitle(title: string): boolean {
  const trimmed = title.trim();
  return /^https?:\/\//i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(trimmed);
}

function isOpaqueIdentifier(title: string): boolean {
  const trimmed = title.trim();
  return /^id\d{6,}$/i.test(trimmed) || (/^[a-z0-9_-]{6,12}$/i.test(trimmed) && /\d/.test(trimmed));
}

function isDomainOnlyTitle(title: string, domain: string | null): boolean {
  if (!domain) return false;
  const normalized = title.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return normalized === domain.toLowerCase();
}

function isLowQualityTitle(title: string, domain: string | null): boolean {
  return (
    isGenericTitle(title) ||
    isUrlLikeTitle(title) ||
    isOpaqueIdentifier(title) ||
    isDomainOnlyTitle(title, domain)
  );
}

function titleQualityScore(title: string, domain: string | null): number {
  const trimmed = title.trim();
  if (!trimmed) return -10;
  if (isLowQualityTitle(trimmed, domain)) return -5;
  if (/^[^a-zA-ZÀ-ÿ]+$/.test(trimmed)) return -4;
  if (trimmed.length < 4) return -2;
  const wordCount = trimmed.split(/\s+/).length;
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(trimmed);
  return (hasLetters ? 5 : 0) + Math.min(wordCount, 8) + Math.min(trimmed.length / 20, 4);
}

function fallbackFromMention(kind: Kind, mentions: Mention[]): string {
  const episodeTitle = latestMentionTitle(mentions);
  const label = KIND_FALLBACK_LABELS[kind];
  return episodeTitle ? `${label} : ${episodeTitle}` : label;
}

const KNOWN_BOOKS = [
  { match: "high output management", title: "High Output Management", author: "Andrew Grove" },
  { match: "three body problem", title: "The Three-Body Problem", author: "Cixin Liu" },
  { match: "radical candor", title: "Radical Candor", author: "Kim Scott" },
  { match: "working backwards", title: "Working Backwards", author: "Colin Bryar, Bill Carr" },
  { match: "crossing chasm", title: "Crossing the Chasm", author: "Geoffrey A. Moore" },
  { match: "playing win", title: "Playing to Win", author: "A.G. Lafley, Roger Martin" },
  { match: "hard thing about hard things", title: "The Hard Thing About Hard Things", author: "Ben Horowitz" },
  { match: "hard thing about things", title: "The Hard Thing About Hard Things", author: "Ben Horowitz" },
  { match: "how win friends influence people", title: "How to Win Friends and Influence People", author: "Dale Carnegie" },
];

function formatKnownBookTitle(rawTitle: string): string | null {
  const comparable = normalizeComparableTitle(rawTitle);
  const known = KNOWN_BOOKS.find((book) => comparable.includes(book.match));
  return known ? `${known.title} (${known.author})` : null;
}

function formatLikelyBookTitleAndAuthor(rawTitle: string): string {
  const known = formatKnownBookTitle(rawTitle);
  if (known) return known;

  const words = rawTitle.split(/\s+/).filter(Boolean);
  if (words.length < 4) return rawTitle;

  const lastTwo = words.slice(-2);
  const likelyAuthor = lastTwo.every((word) => /^[A-Z][a-z]+\.?$/.test(word));
  if (!likelyAuthor) return rawTitle;

  return `${words.slice(0, -2).join(" ")} (${lastTwo.join(" ")})`;
}

function isAmazonDomain(host: string): boolean {
  return host === "amazon.com" || host === "amazon.fr" || host.endsWith(".amazon.com") || host.endsWith(".amazon.fr");
}

function amazonProductTitle(pathSegments: string[]): string | null {
  const dpIndex = pathSegments.findIndex((part) => part.toLowerCase() === "dp");
  if (dpIndex > 0) {
    const cleaned = cleanPathSegment(pathSegments[dpIndex - 1]);
    if (cleaned.length > 2 && !isOpaqueIdentifier(cleaned)) return formatLikelyBookTitleAndAuthor(cleaned);
  }

  const productIndex = pathSegments.findIndex((part) => part.toLowerCase() === "product");
  if (productIndex > 1 && pathSegments[productIndex - 1]?.toLowerCase() === "gp") {
    return null;
  }

  for (const part of pathSegments) {
    const cleaned = cleanPathSegment(part);
    if (
      cleaned.length > 2 &&
      !isOpaqueIdentifier(cleaned) &&
      !["dp", "gp", "product"].includes(cleaned.toLowerCase())
    ) {
      return formatLikelyBookTitleAndAuthor(cleaned);
    }
  }

  return null;
}

function podcastSlugFromApplePath(pathSegments: string[]): string | null {
  const podcastIndex = pathSegments.findIndex((part) => part.toLowerCase() === "podcast");
  const candidates = podcastIndex >= 0 ? pathSegments.slice(podcastIndex + 1) : pathSegments;
  return candidates.find((part) => !/^[a-z]{2}(?:-[a-z]{2})?$/i.test(part) && !/^id\d+$/i.test(part)) ?? null;
}

function isLennyPodcastResource(title: string, url: string, kind: Kind, domain: string | null): boolean {
  if (kind !== "podcast") return false;
  const normalizedTitle = title.trim().toLowerCase().replace("’", "'");
  const lennyDomains = new Set(["lennysnewsletter.com", "lennyspodcast.com", "lennyrachitsky.com"]);
  if (
    (domain != null && lennyDomains.has(domain)) ||
    normalizedTitle === "lenny's podcast" ||
    normalizedTitle.startsWith("lenny's podcast:")
  ) return true;
  try {
    return lennyDomains.has(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

function isDataGenPodcastResource(title: string, url: string, kind: Kind, domain: string | null): boolean {
  if (kind !== "podcast") return false;
  const normalizedTitle = normalizeComparableTitle(title);
  const compactTitle = normalizedTitle.replace(/\s+/g, "");
  if (
    compactTitle === "datagen" ||
    normalizedTitle.startsWith("data gen ") ||
    normalizedTitle.startsWith("datagen ")
  ) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const pathSegments = u.pathname.split("/").filter(Boolean);
    const appleSlug = host === "podcasts.apple.com" ? podcastSlugFromApplePath(pathSegments) : null;
    return domain === "datagen.fr" || appleSlug?.replace(/-/g, "") === "datagen";
  } catch {
    return false;
  }
}

function canonicalResourceKey(url: string, title: string, kind: Kind, domain: string | null): string {
  if (isLennyPodcastResource(title, url, kind, domain)) return "podcast:lennys-podcast";
  if (isDataGenPodcastResource(title, url, kind, domain)) return "podcast:datagen";
  return normalizeUrl(url);
}

function deriveTitleFromUrl(url: string, domain: string | null, kind: Kind, mentions: Mention[]): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const pathSegments = u.pathname.split("/").filter(Boolean);
    const seg = pathSegments[pathSegments.length - 1];

    if (SHORTENER_DOMAINS.has(host)) {
      return fallbackFromMention(kind, mentions);
    }

    if (isAmazonDomain(host)) {
      return amazonProductTitle(pathSegments) ?? fallbackFromMention("book", mentions);
    }

    if (host.endsWith("wikipedia.org")) {
      const wikiTopic = pathSegments[pathSegments.length - 1];
      if (wikiTopic) return cleanPathSegment(wikiTopic);
    }

    if ((host === "youtube.com" || host === "m.youtube.com") && pathSegments[0]?.startsWith("@")) {
      const handle = pathSegments[0].replace(/^@/, "");
      if (handle === "data-gen") return "Chaîne YouTube : DataGen";
      return `Chaîne YouTube : ${cleanPathSegment(handle)}`;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      return fallbackFromMention("video", mentions);
    }

    if (host === "podcasts.apple.com") {
      const podcastSlug = podcastSlugFromApplePath(pathSegments);
      if (podcastSlug?.replace(/-/g, "") === "datagen") return "DataGen";
      if (podcastSlug) return cleanPathSegment(podcastSlug);
      return fallbackFromMention("podcast", mentions);
    }

    if (host === "open.spotify.com") {
      const name = seg && !/^[a-z0-9]{18,}$/i.test(seg) ? cleanPathSegment(seg) : "";
      return name || fallbackFromMention(kind === "podcast" ? "podcast" : kind, mentions);
    }

    if (host === "linkedin.com" && pathSegments[0] === "in" && pathSegments[1]) {
      return `Profil LinkedIn : ${cleanPathSegment(pathSegments[1])}`;
    }

    if ((host === "x.com" || host === "twitter.com") && pathSegments[0]) {
      return `Profil X : ${cleanPathSegment(pathSegments[0])}`;
    }

    if ((host === "github.com" || host === "gitlab.com") && pathSegments.length > 0) {
      return pathSegments.slice(0, 2).map(cleanPathSegment).join(" / ");
    }

    if (seg) {
      const cleaned = cleanPathSegment(seg);
      if (cleaned.length > 2 && !isLowQualityTitle(cleaned, domain)) {
        return cleaned;
      }
    }

    if (domain) return readableDomainName(domain);
  } catch {
    /* fall through */
  }
  return domain ? readableDomainName(domain) : fallbackFromMention(kind, mentions);
}

function normalizeKnownResourceTitle(title: string, url: string, kind: Kind, domain: string | null): string {
  if (isLennyPodcastResource(title, url, kind, domain)) {
    return "Lenny's Podcast";
  }

  if (isDataGenPodcastResource(title, url, kind, domain)) {
    return "DataGen";
  }

  if (domain === "datageneration.substack.com" || domain === "datageneration.cc") {
    return "La newsletter de DataGeneration";
  }

  if (domain === "tim.blog") {
    return "Le blog de Tim Ferriss";
  }

  if (domain === "seths.blog") {
    return "Le blog de Seth Godin";
  }

  return title;
}

function pickBestTitle(current: string, candidate: string, domain: string | null): string {
  const currentScore = titleQualityScore(current, domain);
  const candidateScore = titleQualityScore(candidate, domain);
  if (candidateScore !== currentScore) return candidateScore > currentScore ? candidate : current;
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
      const key = canonicalResourceKey(rec.url, rec.title, rec.kind, dom);
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
        existing.title = pickBestTitle(existing.title, rec.title, existing.domain);
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

  // Final pass: replace URLs, shortlink IDs, bare domains and other opaque labels
  // with something scannable by a human.
  for (const r of all) {
    r.title = normalizeKnownResourceTitle(r.title, r.url, r.kind, r.domain);
    if (isLowQualityTitle(r.title, r.domain)) {
      r.title = deriveTitleFromUrl(r.url, r.domain, r.kind, r.mentions);
    }
  }

  // Compute kind counts BEFORE filtering by kind, but AFTER text/theme filters
  let textFilter: ((r: Aggregated) => boolean) | null = null;
  if (q && q.trim().length) {
    const needle = q.trim().toLowerCase();
    const comparableNeedle = normalizeComparableTitle(q);
    const compactNeedle = comparableNeedle.replace(/\s+/g, "");
    textFilter = (r) =>
      r.title.toLowerCase().includes(needle) ||
      normalizeComparableTitle(r.title).includes(comparableNeedle) ||
      normalizeComparableTitle(r.title).replace(/\s+/g, "").includes(compactNeedle) ||
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
  const parsed = ListResourcesQueryParams.safeParse(
    normalizeArrayQuery(req.query, ["themes"]),
  );
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    return;
  }
  const result = await aggregateResources(parsed.data);
  res.json(result);
});

export default router;
