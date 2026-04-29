import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import type { InsertEpisode } from "../lib/db";

export const DATAGEN_RSS_URL =
  "https://feeds.acast.com/public/shows/5fa58959e64011214fbf140d";

export interface PodcastFeedConfig {
  slug: string;
  name: string;
  author: string;
  url: string;
}

export const PODCAST_FEEDS: PodcastFeedConfig[] = [
  {
    slug: "datagen",
    name: "DataGen",
    author: "Robin Conquet",
    url: DATAGEN_RSS_URL,
  },
  {
    slug: "analytics-engineering-podcast",
    name: "The Analytics Engineering Podcast",
    author: "dbt Labs, Inc.",
    url: "https://rss.libsyn.com/shows/352538/destinations/2880773.xml",
  },
  {
    slug: "lennys-podcast",
    name: "Lenny's Podcast",
    author: "Lenny Rachitsky",
    url: "https://api.substack.com/feed/podcast/10845.rss",
  },
  {
    slug: "ai-engineering-podcast",
    name: "AI Engineering Podcast",
    author: "Christophe Blefari & Julien Hurault",
    url: "https://pub-4ff2e85593bd4bee9df83cd32bec10ca.r2.dev/feed/podcast.xml",
  },
];

interface RawItem {
  guid?: string | { "#text"?: string };
  title?: string;
  description?: string;
  "content:encoded"?: string;
  pubDate?: string;
  enclosure?: { "@_url"?: string; "@_length"?: string; "@_type"?: string };
  link?: string;
  "itunes:duration"?: string | number;
  "itunes:image"?: { "@_href"?: string };
  "itunes:episode"?: number | string;
  "itunes:summary"?: string;
  "itunes:subtitle"?: string;
  language?: string;
}

interface RawFeed {
  rss?: {
    channel?: {
      item?: RawItem | RawItem[];
      title?: string;
      "itunes:author"?: string;
      "itunes:image"?: { "@_href"?: string };
      image?: { url?: string };
      language?: string;
    };
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  textNodeName: "#text",
  cdataPropName: "#cdata",
  parseTagValue: false,
});

export interface ParsedItem extends Omit<
  InsertEpisode,
  "createdAt" | "updatedAt" | "themesExtractedAt"
> {
  recommendations: ReturnType<typeof parseDescription>["recommendations"];
  chapters: ReturnType<typeof parseDescription>["chapters"];
  relatedLinks: ReturnType<typeof parseDescription>["relatedLinks"];
}

function getText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v["#cdata"] === "string") return v["#cdata"] as string;
    if (typeof v["#text"] === "string") return v["#text"] as string;
  }
  return "";
}

function parseDuration(raw: unknown): number {
  if (typeof raw === "number") return Math.round(raw);
  const s = typeof raw === "string" ? raw : "";
  if (!s) return 0;
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p) || 0);
    let acc = 0;
    for (const p of parts) acc = acc * 60 + p;
    return acc;
  }
  return Number(s) || 0;
}

function stableId(guid: string, link: string, title: string): string {
  if (guid) return guid;
  if (title) return `${link || "episode"}:${title}`;
  if (link) return link;
  return title;
}

function normalizeLanguageCode(value: unknown, fallback = "fr"): string {
  const raw = getText(value).trim() || fallback;
  return raw.slice(0, 2).toLowerCase();
}

export interface FetchResult {
  items: ParsedItem[];
  channelImage: string;
  language: string;
}

export async function fetchAndParseFeed(): Promise<FetchResult> {
  const results = await Promise.all(
    PODCAST_FEEDS.map((feed) => fetchAndParseOneFeed(feed)),
  );
  return {
    items: results.flatMap((r) => r.items),
    channelImage: results[0]?.channelImage ?? "",
    language: results[0]?.language ?? "fr",
  };
}

async function fetchAndParseOneFeed(
  feed: PodcastFeedConfig,
): Promise<FetchResult> {
  const response = await fetch(feed.url, {
    headers: {
      "user-agent": "PodcastDataMiner/1.0 (+https://replit.com)",
      accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`RSS fetch failed for ${feed.name}: ${response.status}`);
  }
  const xml = await response.text();
  const data = parser.parse(xml) as RawFeed;
  const channel = data.rss?.channel;
  if (!channel) throw new Error("Invalid RSS: missing channel");

  const channelImage =
    channel["itunes:image"]?.["@_href"] ?? channel.image?.url ?? "";
  const language = normalizeLanguageCode(channel.language, "fr");

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];

  const items: ParsedItem[] = rawItems.map((item) => {
    const guid =
      typeof item.guid === "string" ? item.guid : (item.guid?.["#text"] ?? "");
    const title = getText(item.title).trim();
    const link = getText(item.link).trim();
    const rawId = stableId(guid, link, title);
    const id = feed.slug === "datagen" ? rawId : `${feed.slug}:${rawId}`;

    const descriptionHtml = (
      getText(item["content:encoded"]) || getText(item.description)
    ).trim();
    const summary =
      getText(item["itunes:subtitle"]).trim() ||
      getText(item["itunes:summary"]).trim() ||
      null;

    const $desc = cheerio.load(`<div>${descriptionHtml}</div>`);
    const descriptionText = $desc("div").text().replace(/\s+/g, " ").trim();

    const audioUrl = item.enclosure?.["@_url"] ?? "";
    const imageUrl = item["itunes:image"]?.["@_href"] ?? channelImage;
    const durationSec = parseDuration(item["itunes:duration"]);
    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
    const episodeNumberRaw = item["itunes:episode"];
    const episodeNumber =
      episodeNumberRaw != null && !Number.isNaN(Number(episodeNumberRaw))
        ? Number(episodeNumberRaw)
        : null;

    const sections = parseDescription(descriptionHtml);

    const itemLanguage = inferEpisodeLanguage(
      normalizeLanguageCode(item.language, language),
      title,
      descriptionText,
    );

    const searchText = [
      feed.name,
      feed.author,
      title,
      summary ?? "",
      descriptionText,
      ...sections.recommendations.map((r) => r.title),
      ...sections.chapters.map((c) => c.title),
      ...sections.relatedLinks.map((r) => r.title),
    ]
      .join(" \n ")
      .toLowerCase();

    return {
      id,
      podcastSlug: feed.slug,
      podcastName: feed.name,
      podcastAuthor: feed.author,
      episodeNumber,
      title,
      summary,
      descriptionHtml,
      descriptionText,
      pubDate,
      durationSec,
      audioUrl,
      link,
      imageUrl,
      language: itemLanguage,
      themes: [],
      tools: [],
      recommendations: sections.recommendations,
      chapters: sections.chapters,
      relatedLinks: sections.relatedLinks,
      searchText,
    };
  });

  return { items, channelImage, language };
}

function inferEpisodeLanguage(
  defaultLanguage: string,
  title: string,
  descriptionText: string,
): string {
  const normalizedDefault = defaultLanguage.slice(0, 2).toLowerCase() || "fr";
  const text = `${title}\n${descriptionText}`;
  if (
    /🇪🇺|\b(we cover|what is|their stack|other episodes you should love|more data content|support the podcast)\b/i.test(
      text,
    )
  ) {
    return "en";
  }
  if (normalizedDefault === "en") return "en";
  const englishMatches =
    text.match(
      /\b(the|and|with|what|why|how|their|data|team|career|product|growth|engineering)\b/gi,
    )?.length ?? 0;
  const frenchMatches =
    text.match(
      /\b(le|la|les|des|avec|pour|dans|une|vous|nous|équipe|donnees|données)\b/gi,
    )?.length ?? 0;
  if (englishMatches >= 8 && englishMatches > frenchMatches * 1.5) return "en";
  return normalizedDefault;
}

// ---------- Description parsing ----------

type RecommendationKind =
  | "book"
  | "profile"
  | "article"
  | "video"
  | "podcast"
  | "other";

export interface ParsedSections {
  recommendations: { title: string; url: string; kind: RecommendationKind }[];
  chapters: { timeSec: number; title: string }[];
  relatedLinks: {
    title: string;
    url: string;
    episodeNumber: number | null;
    episodeId: string | null;
  }[];
}

const SECTION_PATTERNS = {
  resources:
    /(?:📚|📖|📗|📘)?\s*(?:RESOURCES?|RESSOURCES?|R[EÉ]F[EÉ]RENCES?|MENTIONS?)/i,
  chapters: /(?:🎬|⏱|⏰)?\s*(?:CHAPTERS?|CHAPITRES?|TIMELINES?|TIMELINE)/i,
  related:
    /(?:🤩|❤|♥|🎧|👉)?\s*(?:OTHER\s+EPISODES?|EPISODES?\s+YOU\s+SHOULD\s+LOVE|EPISODES?\s+RELATED|EPISODES?\s+(?:[AÀ]\s+)?(?:[EÉ]COUTER|D[EÉ]COUVRIR)|AUTRES?\s+EPISODES?|[AÀ]\s+[EÉ]COUTER|POUR\s+ALLER\s+PLUS\s+LOIN|RELATED\s+EPISODES?)/i,
};

function classifyKind(title: string, url: string): RecommendationKind {
  const haystack = `${title} ${url}`.toLowerCase();
  if (/youtu\.?be|vimeo|youtube/.test(haystack)) return "video";
  if (/podcast|acast|spotify|apple\.com\/.*podcast/.test(haystack))
    return "podcast";
  if (/linkedin\.com\/in\/|twitter\.com\/|x\.com\//.test(haystack))
    return "profile";
  if (/amazon|goodreads|fnac|babelio|book|livre/.test(haystack)) return "book";
  if (/medium|substack|blog|article|essay|paper|wiki/.test(haystack))
    return "article";
  return "other";
}

function parseTimecode(s: string): number | null {
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = m[3] != null ? Number(m[3]) : null;
  if (c == null) return a * 60 + b;
  return a * 3600 + b * 60 + c;
}

export function parseDescription(html: string): ParsedSections {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  const root = $("#root");

  // Replace <br> with \n then collect text segments along with collected links.
  // Strategy: walk top-level "lines" formed by splitting at <br> and block-level boundaries.

  // Build a list of (text, links) per logical line.
  // Simpler approach: convert HTML to plain text with markers per line, then per-line, scan original HTML's links by position.
  // Pragmatic approach: split top-level html string on <br> and block tags.
  const blockHtml = $.html(root).replace(/<\/(p|div|li|h[1-6])>/gi, "$&__BR__");
  const lines = blockHtml
    .split(/<br\s*\/?>(?:\s*<br\s*\/?>)*|__BR__/i)
    .map((seg) => seg.trim())
    .filter(Boolean);

  let currentSection: "none" | "resources" | "chapters" | "related" = "none";
  const out: ParsedSections = {
    recommendations: [],
    chapters: [],
    relatedLinks: [],
  };

  for (const segment of lines) {
    const $seg = cheerio.load(`<div>${segment}</div>`);
    const text = $seg("div").text().trim();
    if (!text) continue;

    if (SECTION_PATTERNS.resources.test(text) && text.length < 80) {
      currentSection = "resources";
      continue;
    }
    if (SECTION_PATTERNS.chapters.test(text) && text.length < 80) {
      currentSection = "chapters";
      continue;
    }
    if (SECTION_PATTERNS.related.test(text) && text.length < 120) {
      currentSection = "related";
      continue;
    }

    if (currentSection === "chapters") {
      const ts = parseTimecode(text);
      if (ts != null) {
        const title = text
          .replace(/\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*[-–—:.]?\s*/, " ")
          .replace(/^[-–—:.\s]+|[-–—:.\s]+$/g, "")
          .trim();
        out.chapters.push({ timeSec: ts, title: title || text });
      }
      continue;
    }

    const links: { title: string; url: string }[] = [];
    $seg("a").each((_i, el) => {
      const url = ($seg(el).attr("href") ?? "").trim();
      const t = $seg(el).text().trim();
      if (url && t) links.push({ title: t, url });
    });

    if (currentSection === "resources") {
      if (links.length === 0) continue;
      for (const l of links) {
        out.recommendations.push({
          title: l.title,
          url: l.url,
          kind: classifyKind(l.title, l.url),
        });
      }
    } else if (currentSection === "related") {
      if (links.length === 0) continue;
      for (const l of links) {
        const numMatch =
          l.title.match(/#?(\d{1,3})\b/) ?? l.url.match(/#?(\d{1,3})\b/);
        out.relatedLinks.push({
          title: l.title,
          url: l.url,
          episodeNumber: numMatch ? Number(numMatch[1]) : null,
          episodeId: null,
        });
      }
    }
  }

  // De-duplicate
  const seenRec = new Set<string>();
  out.recommendations = out.recommendations.filter((r) => {
    const k = r.url;
    if (seenRec.has(k)) return false;
    seenRec.add(k);
    return true;
  });
  const seenRel = new Set<string>();
  out.relatedLinks = out.relatedLinks.filter((r) => {
    const k = r.url;
    if (seenRel.has(k)) return false;
    seenRel.add(k);
    return true;
  });
  out.chapters.sort((a, b) => a.timeSec - b.timeSec);

  return out;
}
