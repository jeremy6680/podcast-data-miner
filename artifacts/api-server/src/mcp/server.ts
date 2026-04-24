import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { z } from "zod";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, gte, lte, like, sql, ne, arrayOverlaps } from "drizzle-orm";
import { db, episodesTable } from "../lib/db";
import { THEME_LABELS } from "../sync/themes";
import { themeLabelFromSlug } from "../lib/slug";
import { toFullEpisode, toSummary } from "../routes/episodes";
import { logger } from "../lib/logger";

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "datagen-explorer", version: "1.0.0" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        "Outils pour explorer le podcast français DataGen (Robin Conquet). Recherche, filtrage par thèmes, et accès aux notes d'épisode complètes.",
    },
  );

  server.registerTool(
    "search_episodes",
    {
      title: "Rechercher des épisodes",
      description:
        "Recherche texte libre dans les épisodes DataGen. Filtres facultatifs par thèmes, durée, langue. Renvoie un résumé léger (sans HTML).",
      inputSchema: {
        query: z.string().optional().describe("Texte de recherche (titre ou description)"),
        themes: z.array(z.string()).optional().describe("Slugs de thèmes à filtrer"),
        min_duration_min: z.number().optional(),
        max_duration_min: z.number().optional(),
        sort: z
          .enum(["recent", "oldest", "longest", "shortest"])
          .optional()
          .default("recent"),
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
    },
    async ({ query, themes, min_duration_min, max_duration_min, sort, limit }) => {
      const conditions: SQL[] = [];
      if (query && query.trim()) {
        conditions.push(like(episodesTable.searchText, `%${query.trim().toLowerCase()}%`));
      }
      if (themes && themes.length) {
        conditions.push(arrayOverlaps(episodesTable.themes, themes));
      }
      if (typeof min_duration_min === "number") {
        conditions.push(gte(episodesTable.durationSec, min_duration_min * 60));
      }
      if (typeof max_duration_min === "number") {
        conditions.push(lte(episodesTable.durationSec, max_duration_min * 60));
      }
      const whereClause = conditions.length ? and(...conditions) : undefined;

      const order =
        sort === "longest"
          ? desc(episodesTable.durationSec)
          : sort === "shortest"
            ? asc(episodesTable.durationSec)
            : sort === "oldest"
              ? asc(episodesTable.pubDate)
              : desc(episodesTable.pubDate);

      const rows = await db
        .select()
        .from(episodesTable)
        .where(whereClause)
        .orderBy(order)
        .limit(limit ?? 10);

      const items = rows.map((e) => ({
        id: e.id,
        episode_number: e.episodeNumber,
        title: e.title,
        summary: e.summary,
        pub_date: e.pubDate.toISOString(),
        duration_min: Math.round(e.durationSec / 60),
        audio_url: e.audioUrl,
        link: e.link,
        themes: e.themes ?? [],
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ count: items.length, items }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_episode",
    {
      title: "Détails d'un épisode",
      description:
        "Renvoie tous les détails d'un épisode: description complète, chapitres, ressources mentionnées, épisodes liés cités dans les notes.",
      inputSchema: {
        id: z.string().describe("ID de l'épisode (GUID RSS)"),
      },
    },
    async ({ id }) => {
      const rows = await db.select().from(episodesTable).where(eq(episodesTable.id, id)).limit(1);
      if (rows.length === 0) {
        return { content: [{ type: "text", text: `Aucun épisode trouvé pour id=${id}` }], isError: true };
      }
      const ep = toFullEpisode(rows[0]!);
      const text = JSON.stringify(
        {
          id: ep.id,
          episode_number: ep.episodeNumber,
          title: ep.title,
          summary: ep.summary,
          pub_date: ep.pubDate,
          duration_min: Math.round(ep.durationSec / 60),
          audio_url: ep.audioUrl,
          link: ep.link,
          themes: ep.themes,
          description: ep.descriptionText,
          chapters: ep.chapters,
          recommendations: ep.recommendations,
          related_links: ep.relatedLinks,
        },
        null,
        2,
      );
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "list_themes",
    {
      title: "Lister les thèmes",
      description:
        "Liste tous les thèmes (slug + libellé + nombre d'épisodes), triés par fréquence.",
      inputSchema: {},
    },
    async () => {
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
      return { content: [{ type: "text", text: JSON.stringify(themes, null, 2) }] };
    },
  );

  server.registerTool(
    "get_related_episodes",
    {
      title: "Épisodes liés",
      description: "Renvoie les épisodes liés (par thèmes communs) à un épisode donné.",
      inputSchema: {
        id: z.string(),
        limit: z.number().int().min(1).max(20).optional().default(6),
      },
    },
    async ({ id, limit }) => {
      const rows = await db.select().from(episodesTable).where(eq(episodesTable.id, id)).limit(1);
      if (rows.length === 0) {
        return { content: [{ type: "text", text: `Aucun épisode trouvé pour id=${id}` }], isError: true };
      }
      const themes = rows[0]!.themes ?? [];
      if (themes.length === 0) {
        return { content: [{ type: "text", text: "[]" }] };
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
        .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.ep.pubDate.getTime() - a.ep.pubDate.getTime()))
        .slice(0, limit ?? 6)
        .map((r) => ({
          ...toSummary(r.ep),
          shared_themes: (r.ep.themes ?? []).filter((t) => themes.includes(t)),
        }));
      return { content: [{ type: "text", text: JSON.stringify(ranked, null, 2) }] };
    },
  );

  server.registerTool(
    "list_resources",
    {
      title: "Lister les ressources",
      description:
        "Liste toutes les ressources (livres, podcasts, vidéos, articles, profils, liens) mentionnées dans les épisodes, agrégées par URL.",
      inputSchema: {
        query: z.string().optional().describe("Texte de recherche (titre ou domaine)"),
        kind: z.enum(["book", "profile", "article", "video", "podcast", "other"]).optional(),
        themes: z.array(z.string()).optional().describe("Filtrer par slugs de thèmes des épisodes source"),
        sort: z.enum(["mentions", "recent", "title"]).optional().default("mentions"),
        limit: z.number().int().min(1).max(100).optional().default(30),
      },
    },
    async ({ query, kind, themes, sort, limit }) => {
      const { aggregateResources } = await import("../routes/resources");
      const result = await aggregateResources({
        q: query,
        kind,
        themes,
        sortBy: sort,
        limit,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}

export async function handleMcpRequest(req: Request, res: Response) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
  });
  try {
    const server = buildServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error({ err }, "MCP request failed");
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
}
