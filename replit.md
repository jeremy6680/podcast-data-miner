# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## DataGen Explorer (project)

French web app exploring the DataGen podcast (Robin Conquet) archive.

### Artifacts
- `artifacts/api-server` — Express + Drizzle, RSS sync, OpenAI theme extraction (gpt-5-mini), MCP server at `/api/mcp` (4 tools: `search_episodes`, `get_episode`, `list_themes`, `get_related_episodes`).
- `artifacts/datagen-explorer` — React + Vite frontend (Home, Episode detail, Themes pages). French UI, wouter routing, shadcn/ui, framer-motion.

### Data flow
1. RSS fetch from `https://feeds.acast.com/public/shows/data-gen` → parse with `rss-parser`.
2. Description parsed with `cheerio` to extract recommendations (book/podcast/video/article/profile/other), chapters (`hh:mm:ss title`), related episodes (links pointing to other DataGen episodes).
3. Themes assigned via gpt-5-mini using a closed taxonomy in `artifacts/api-server/src/sync/themes.ts`.
4. Stored as `episodes` row (jsonb arrays for recommendations/chapters/relatedLinks; `themes text[]`).

### API conventions
- Episode summary fields: `id`, `episodeNumber`, `title`, `summary`, `pubDate`, `durationSec`, `audioUrl`, `link`, `imageUrl`, `language`, `themes: string[]`.
- Full episode adds `descriptionHtml`, `descriptionText`, `recommendations[]`, `chapters[]`, `relatedLinks[]`.
- Themes are flat slug strings on episodes; the `/themes` endpoint returns `{slug, name, count}` objects derived from the in-memory taxonomy.
- Postgres array overlap uses drizzle's `arrayOverlaps()`, NOT `sql\`themes && ${arr}::text[]\`` (that produces a tuple, not an array).

### Frontend conventions
- All UI strings in French.
- Sentinel `__any__` used for empty Select values (Radix forbids empty string).
- Date formatting: `formatRelativeDateFR`, `formatDurationFromSeconds` in `src/lib/format.ts`.
- Layout shows live sync progress in the header.
