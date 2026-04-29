import pLimit from "p-limit";
import { eq, sql } from "drizzle-orm";
import { db, episodesTable, syncStateTable } from "../lib/db";
import { logger } from "../lib/logger";
import { fetchAndParseFeed, type ParsedItem } from "./rss";
import { extractThemesForEpisode } from "./themes";
import { extractToolsForEpisode } from "./tools";

export type SyncStateValue =
  | "idle"
  | "fetching"
  | "parsing"
  | "extracting"
  | "done"
  | "error";

interface SyncOptions {
  force?: boolean;
  extractThemes?: boolean;
}

let isRunning = false;

async function ensureRow() {
  const rows = await db.select().from(syncStateTable).limit(1);
  if (rows.length === 0) {
    await db.insert(syncStateTable).values({ id: 1, state: "idle" });
  }
}

export async function getSyncStatus() {
  await ensureRow();
  const rows = await db.select().from(syncStateTable).limit(1);
  const row = rows[0]!;
  return {
    state: row.state as SyncStateValue,
    totalEpisodes: row.totalEpisodes,
    processedEpisodes: row.processedEpisodes,
    message: row.message,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

async function setStatus(patch: {
  state?: SyncStateValue;
  totalEpisodes?: number;
  processedEpisodes?: number;
  message?: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}) {
  await ensureRow();
  await db
    .update(syncStateTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(syncStateTable.id, 1));
}

export function isSyncRunning() {
  return isRunning;
}

export async function startSync(opts: SyncOptions = {}): Promise<void> {
  if (isRunning) {
    logger.info("Sync already running, ignoring start request");
    return;
  }
  isRunning = true;
  const startedAt = new Date();

  void runSync(opts, startedAt).finally(() => {
    isRunning = false;
  });
}

async function runSync(opts: SyncOptions, startedAt: Date) {
  const extractThemes = opts.extractThemes !== false;
  try {
    await setStatus({
      state: "fetching",
      processedEpisodes: 0,
      totalEpisodes: 0,
      message: "Récupération du flux RSS…",
      startedAt,
      finishedAt: null,
    });

    const { items } = await fetchAndParseFeed();
    logger.info({ count: items.length }, "RSS feed parsed");

    await setStatus({
      state: "parsing",
      totalEpisodes: items.length,
      message: `Analyse de ${items.length} épisodes…`,
    });

    // Build podcast + episode-number → id map for relatedLinks resolution.
    const numberToId = new Map<string, string>();
    for (const it of items) {
      if (it.episodeNumber != null) numberToId.set(`${it.podcastSlug}:${it.episodeNumber}`, it.id);
    }

    // Resolve related episode ids
    for (const it of items) {
      it.relatedLinks = it.relatedLinks.map((l) => {
        const key = l.episodeNumber != null ? `${it.podcastSlug}:${l.episodeNumber}` : null;
        return {
          ...l,
          episodeId: key && numberToId.has(key) ? numberToId.get(key)! : null,
        };
      });
    }

    // Upsert all episodes (without themes initially)
    await upsertAll(items);
    logger.info("Episodes upserted to database");

    if (!extractThemes) {
      await setStatus({
        state: "done",
        processedEpisodes: items.length,
        message: `Synchronisation terminée (${items.length} épisodes).`,
        finishedAt: new Date(),
      });
      return;
    }

    // Decide which episodes need theme extraction
    const existing = await db
      .select({
        id: episodesTable.id,
        themesExtractedAt: episodesTable.themesExtractedAt,
      })
      .from(episodesTable);
    const extractedSet = new Set(
      existing.filter((e) => e.themesExtractedAt != null).map((e) => e.id),
    );

    const toExtract = items.filter(
      (it) => opts.force || !extractedSet.has(it.id),
    );

    await setStatus({
      state: "extracting",
      processedEpisodes: 0,
      totalEpisodes: toExtract.length,
      message: `Extraction des thèmes (${toExtract.length} épisodes)…`,
    });

    const limit = pLimit(5);
    let processed = 0;
    await Promise.all(
      toExtract.map((it) =>
        limit(async () => {
          try {
            const themes = await extractThemesForEpisode({
              id: it.id,
              title: it.title,
              summary: it.summary,
              descriptionText: it.descriptionText,
            });
            await db
              .update(episodesTable)
              .set({ themes, themesExtractedAt: new Date() })
              .where(eq(episodesTable.id, it.id));
          } catch (err) {
            logger.warn({ err, id: it.id }, "Theme extraction failed");
          } finally {
            processed += 1;
            if (processed % 5 === 0 || processed === toExtract.length) {
              await setStatus({
                processedEpisodes: processed,
                message: `Extraction des thèmes (${processed}/${toExtract.length})…`,
              });
            }
          }
        }),
      ),
    );

    await setStatus({
      state: "done",
      processedEpisodes: toExtract.length,
      totalEpisodes: items.length,
      message: `Synchronisation terminée (${items.length} épisodes, ${toExtract.length} traités pour les thèmes).`,
      finishedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Sync failed");
    await setStatus({
      state: "error",
      message: `Erreur: ${message}`,
      finishedAt: new Date(),
    });
  }
}

async function upsertAll(items: ParsedItem[]) {
  if (items.length === 0) return;
  // Chunk to avoid huge payloads
  const chunk = 50;
  for (let i = 0; i < items.length; i += chunk) {
    const slice = items.slice(i, i + chunk);
    await db
      .insert(episodesTable)
      .values(
        slice.map((it) => ({
          id: it.id,
          episodeNumber: it.episodeNumber,
          podcastSlug: it.podcastSlug,
          podcastName: it.podcastName,
          podcastAuthor: it.podcastAuthor,
          title: it.title,
          summary: it.summary,
          descriptionHtml: it.descriptionHtml,
          descriptionText: it.descriptionText,
          pubDate: it.pubDate,
          durationSec: it.durationSec,
          audioUrl: it.audioUrl,
          link: it.link,
          imageUrl: it.imageUrl,
          language: it.language,
          themes: [],
          tools: extractToolsForEpisode(it),
          recommendations: it.recommendations,
          chapters: it.chapters,
          relatedLinks: it.relatedLinks,
          searchText: it.searchText,
        })),
      )
      .onConflictDoUpdate({
        target: episodesTable.id,
        set: {
          episodeNumber: sql`excluded.episode_number`,
          podcastSlug: sql`excluded.podcast_slug`,
          podcastName: sql`excluded.podcast_name`,
          podcastAuthor: sql`excluded.podcast_author`,
          title: sql`excluded.title`,
          summary: sql`excluded.summary`,
          descriptionHtml: sql`excluded.description_html`,
          descriptionText: sql`excluded.description_text`,
          pubDate: sql`excluded.pub_date`,
          durationSec: sql`excluded.duration_sec`,
          audioUrl: sql`excluded.audio_url`,
          link: sql`excluded.link`,
          imageUrl: sql`excluded.image_url`,
          language: sql`excluded.language`,
          tools: sql`excluded.tools`,
          recommendations: sql`excluded.recommendations`,
          chapters: sql`excluded.chapters`,
          relatedLinks: sql`excluded.related_links`,
          searchText: sql`excluded.search_text`,
          updatedAt: new Date(),
        },
      });
  }
}
