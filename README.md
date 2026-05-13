# Podcast Data Miner

Application for collecting and exploring episodes from curated data, product, and AI podcasts.

The project syncs public RSS feeds into PostgreSQL, extracts resources and tools mentioned in episode descriptions, classifies episodes by theme, and exposes the data through an Express API and a React frontend.

## Stack

- `pnpm` monorepo
- TypeScript
- Express API in `artifacts/api-server`
- React/Vite frontend in `artifacts/datagen-explorer`
- PostgreSQL + Drizzle in `lib/db`
- OpenAPI contract in `lib/api-spec`
- Generated clients/types in `lib/api-client-react` and `lib/api-zod`

## Requirements

- Recent Node.js version
- `pnpm`
- A local or remote PostgreSQL database

This repository intentionally blocks `npm` and `yarn`; use `pnpm`.

## Installation

```bash
pnpm install
```

## Configuration

Create a `.env` file at the repository root with at least:

```bash
DATABASE_URL="postgres://USER:PASSWORD@localhost:5432/podcast_data_miner"
```

Useful environment variables:

```bash
# API
PORT=19899
DATABASE_URL="postgres://USER:PASSWORD@localhost:5432/podcast_data_miner"
LOG_LEVEL=info

# Vite frontend
API_BASE_URL=http://localhost:19899

# Optional AI theme extraction
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-5-haiku-latest

AI_INTEGRATIONS_OPENAI_BASE_URL=...
AI_INTEGRATIONS_OPENAI_API_KEY=...
```

AI keys are optional. If none are configured, the API falls back to local heuristic theme extraction.

## Initialize The Database

Once `DATABASE_URL` is configured:

```bash
pnpm --filter @workspace/db push
```

This applies the Drizzle schema to PostgreSQL.

## Run Locally

Open two terminals.

Terminal 1: start the API on the port expected by the frontend.

```bash
PORT=19899 pnpm --filter @workspace/api-server dev
```

Terminal 2: start the frontend.

```bash
PORT=5173 pnpm --filter @workspace/datagen-explorer dev
```

The app will be available at:

```text
http://localhost:5173
```

The frontend automatically proxies `/api` requests to `http://localhost:19899`.

## Sync Episodes

From the UI, use the RSS sync button.

You can also trigger a sync over HTTP:

```bash
curl -X POST http://localhost:19899/api/sync \
  -H "Content-Type: application/json" \
  -d '{"extractThemes": true}'
```

Check sync status:

```bash
curl http://localhost:19899/api/sync/status
```

Request body options:

- `extractThemes`: runs theme extraction, defaults to `true`.
- `force`: re-extracts themes for episodes that were already processed.

To import episodes quickly without AI theme extraction:

```bash
curl -X POST http://localhost:19899/api/sync \
  -H "Content-Type: application/json" \
  -d '{"extractThemes": false}'
```

## Static Netlify Build

The app can also run as a static site without the Express API or PostgreSQL at
runtime. A local script fetches the RSS feeds and writes a catalog consumed by
the frontend:

```bash
# Generate artifacts/datagen-explorer/public/static-data.json
pnpm run refresh:static

# Refresh the catalog and validate the static frontend build
pnpm run refresh:static:checked

# Faster refresh without AI/provider theme extraction
pnpm run refresh:static -- --no-themes

# Build the frontend so /api calls are served from the static catalog
pnpm run build:static
```

Netlify is configured in `netlify.toml` to run:

```bash
pnpm run refresh:static && pnpm run build:static
```

If you prefer the Git-based workflow, run `pnpm run refresh:static` locally,
commit the generated JSON, and change the Netlify build command to only
`pnpm run build:static`.

For scheduled local refreshes, use `pnpm run refresh:static:checked`. It wraps
the refresh and build validation in `scripts/refresh-static-data.sh`, which makes
it suitable for a daily scheduler such as Codex automations, `cron`, or macOS
`launchd`.

## Useful Commands

```bash
# Full typecheck
pnpm run typecheck

# Full build
pnpm run build

# Refresh static podcast data and verify the static build
pnpm run refresh:static:checked

# API build only
pnpm --filter @workspace/api-server build

# Frontend build only
pnpm --filter @workspace/datagen-explorer build

# Regenerate clients/types from the OpenAPI contract
pnpm --filter @workspace/api-spec codegen
```

## API

The API is served under `/api`.

Main endpoints:

- `GET /api/healthz`
- `GET /api/episodes`
- `GET /api/episodes/:id`
- `GET /api/episodes/:id/related`
- `GET /api/resources`
- `GET /api/themes`
- `GET /api/stats`
- `POST /api/sync`
- `GET /api/sync/status`
- `ALL /api/mcp`

The OpenAPI contract is located at `lib/api-spec/openapi.yaml`.

## Repository Structure

```text
artifacts/
  api-server/          Express API, routes, and RSS sync
  datagen-explorer/   React/Vite frontend
  mockup-sandbox/     UI sandbox

lib/
  api-spec/           OpenAPI specification and Orval generation
  api-client-react/   Generated React API client
  api-zod/            Generated Zod API schemas
  db/                 Drizzle schema and PostgreSQL connection
  integrations-openai-ai-server/
                       Server-side OpenAI integration

scripts/              Utility scripts
```

## Development Notes

- The API `dev` script builds the server and then runs `dist/index.mjs`; it does not hot-reload automatically.
- Sync reads these public RSS feeds:
  - DataGen: `https://feeds.acast.com/public/shows/5fa58959e64011214fbf140d`
  - The Analytics Engineering Podcast: `https://rss.libsyn.com/shows/352538/destinations/2880773.xml`
  - Lenny's Podcast: `https://api.substack.com/feed/podcast/10845.rss`
  - AI Engineering Podcast: `https://pub-4ff2e85593bd4bee9df83cd32bec10ca.r2.dev/feed/podcast.xml`
- Main data is stored in the `episodes` and `sync_state` tables.
- If the UI shows an empty database, trigger an RSS sync and refresh the UI once the status is `done`.
