import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const syncStateTable = pgTable("sync_state", {
  id: serial("id").primaryKey(),
  state: text("state").notNull().default("idle"),
  totalEpisodes: integer("total_episodes").notNull().default(0),
  processedEpisodes: integer("processed_episodes").notNull().default(0),
  message: text("message").notNull().default(""),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SyncState = typeof syncStateTable.$inferSelect;
