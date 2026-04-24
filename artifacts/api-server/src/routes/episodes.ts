import { Router, type IRouter } from "express";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gte, lte, like, sql, ne, arrayOverlaps } from "drizzle-orm";
import { db, episodesTable } from "../lib/db";
import { ListEpisodesQueryParams, GetRelatedEpisodesQueryParams } from "@workspace/api-zod";
import { THEME_LABELS } from "../sync/themes";
import { themeLabelFromSlug } from "../lib/slug";

const router: IRouter = Router();

function toSummary(e: typeof episodesTable.$inferSelect) {
  return {
    id: e.id,
    episodeNumber: e.episodeNumber,
    title: e.title,
    summary: e.summary,
    pubDate: e.pubDate.toISOString(),
    durationSec: e.durationSec,
    audioUrl: e.audioUrl,
    link: e.link,
    imageUrl: e.imageUrl,
    language: e.language,
    themes: e.themes ?? [],
  };
}

function toFullEpisode(e: typeof episodesTable.$inferSelect) {
  return {
    ...toSummary(e),
    descriptionHtml: e.descriptionHtml,
    descriptionText: e.descriptionText,
    recommendations: e.recommendations ?? [],
    chapters: e.chapters ?? [],
    relatedLinks: e.relatedLinks ?? [],
  };
}

router.get("/episodes", async (req, res) => {
  const parsed = ListEpisodesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    return;
  }
  const { q, themes, minDurationSec, maxDurationSec, language, sortBy, sortOrder, limit, offset } = parsed.data;

  const themeSlugs: string[] = themes ?? [];

  const conditions: SQL[] = [];
  if (q && q.trim().length) {
    const pattern = `%${q.trim().toLowerCase()}%`;
    conditions.push(like(episodesTable.searchText, pattern));
  }
  if (themeSlugs.length > 0) {
    conditions.push(arrayOverlaps(episodesTable.themes, themeSlugs));
  }
  if (typeof minDurationSec === "number") conditions.push(gte(episodesTable.durationSec, minDurationSec));
  if (typeof maxDurationSec === "number") conditions.push(lte(episodesTable.durationSec, maxDurationSec));
  if (language && language.length) conditions.push(eq(episodesTable.language, language));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const sortColumn =
    sortBy === "duration"
      ? episodesTable.durationSec
      : sortBy === "episode_number"
        ? episodesTable.episodeNumber
        : sortBy === "title"
          ? episodesTable.title
          : episodesTable.pubDate;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const itemsQuery = db
    .select()
    .from(episodesTable)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);
  const countQuery = db
    .select({ c: sql<number>`count(*)::int` })
    .from(episodesTable)
    .where(whereClause);
  const [items, countRows] = await Promise.all([itemsQuery, countQuery]);

  res.json({
    items: items.map(toSummary),
    total: countRows[0]?.c ?? 0,
    limit,
    offset,
  });
});

router.get("/episodes/:id", async (req, res) => {
  const id = req.params.id;
  const rows = await db.select().from(episodesTable).where(eq(episodesTable.id, id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Episode not found" });
    return;
  }
  res.json(toFullEpisode(rows[0]!));
});

router.get("/episodes/:id/related", async (req, res) => {
  const id = req.params.id;
  const parsed = GetRelatedEpisodesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    return;
  }
  const { limit } = parsed.data;

  const rows = await db.select().from(episodesTable).where(eq(episodesTable.id, id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Episode not found" });
    return;
  }
  const episode = rows[0]!;
  const themes = episode.themes ?? [];

  if (themes.length === 0) {
    res.json([]);
    return;
  }

  const candidates = await db
    .select()
    .from(episodesTable)
    .where(and(arrayOverlaps(episodesTable.themes, themes), ne(episodesTable.id, id)));

  const ranked = candidates
    .map((c) => {
      const overlap = (c.themes ?? []).filter((t) => themes.includes(t)).length;
      return { ep: c, score: overlap };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.ep.pubDate.getTime() - a.ep.pubDate.getTime();
    })
    .slice(0, limit)
    .map((r) => toSummary(r.ep));

  res.json(ranked);
});

router.get("/themes", async (_req, res) => {
  const rows = await db
    .select({
      slug: sql<string>`unnest(${episodesTable.themes})`,
      count: sql<number>`count(*)::int`,
    })
    .from(episodesTable)
    .groupBy(sql`unnest(${episodesTable.themes})`)
    .orderBy(sql`count(*) desc`);

  const themes = rows.map((r) => ({
    slug: r.slug,
    name: THEME_LABELS[r.slug] ?? themeLabelFromSlug(r.slug),
    count: Number(r.count),
  }));
  res.json(themes);
});

router.get("/stats", async (_req, res) => {
  const [agg] = await db
    .select({
      totalEpisodes: sql<number>`count(*)::int`,
      totalDurationSec: sql<number>`coalesce(sum(${episodesTable.durationSec}),0)::int`,
      lastEpisodeAt: sql<Date | null>`max(${episodesTable.pubDate})`,
    })
    .from(episodesTable);

  const [{ themesCount }] = await db
    .select({
      themesCount: sql<number>`count(distinct t)::int`,
    })
    .from(sql`(select unnest(${episodesTable.themes}) as t from ${episodesTable}) sub`);

  // Pull last sync time
  const { syncStateTable } = await import("../lib/db");
  const syncRows = await db.select().from(syncStateTable).limit(1);
  const lastSyncAt = syncRows[0]?.finishedAt ?? syncRows[0]?.updatedAt ?? null;

  res.json({
    totalEpisodes: agg?.totalEpisodes ?? 0,
    totalDurationSec: agg?.totalDurationSec ?? 0,
    themesCount: themesCount ?? 0,
    lastSyncAt: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
    lastEpisodeAt: agg?.lastEpisodeAt ? new Date(agg.lastEpisodeAt).toISOString() : null,
  });
});

export default router;
export { toSummary, toFullEpisode };
