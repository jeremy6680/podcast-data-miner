import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const episodesTable = pgTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    podcastSlug: text("podcast_slug").notNull().default("datagen"),
    podcastName: text("podcast_name").notNull().default("DataGen"),
    podcastAuthor: text("podcast_author").notNull().default("Robin Conquet"),
    episodeNumber: integer("episode_number"),
    title: text("title").notNull(),
    summary: text("summary"),
    descriptionHtml: text("description_html").notNull().default(""),
    descriptionText: text("description_text").notNull().default(""),
    pubDate: timestamp("pub_date", { withTimezone: true }).notNull(),
    durationSec: integer("duration_sec").notNull().default(0),
    audioUrl: text("audio_url").notNull().default(""),
    link: text("link").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    language: text("language").notNull().default("fr"),
    themes: text("themes").array().notNull().default([]),
    tools: text("tools").array().notNull().default([]),
    recommendations: jsonb("recommendations").notNull().default([]),
    chapters: jsonb("chapters").notNull().default([]),
    relatedLinks: jsonb("related_links").notNull().default([]),
    searchText: text("search_text").notNull().default(""),
    themesExtractedAt: timestamp("themes_extracted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("episodes_pub_date_idx").on(t.pubDate),
    index("episodes_episode_number_idx").on(t.episodeNumber),
    index("episodes_podcast_slug_idx").on(t.podcastSlug),
  ],
);

export type Episode = typeof episodesTable.$inferSelect;
export type InsertEpisode = typeof episodesTable.$inferInsert;
