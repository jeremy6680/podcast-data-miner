# Project Decisions and Production Setup

This note captures the main decisions, blockers, and production data flow for
Podcast Data Miner.

## Why This Lives in the Project

This is project memory: it explains architectural choices, trade-offs, and
operational behavior. It belongs in the repository rather than in personal
documents so future changes can be made with the same context.

## Important Decisions

The project uses a TypeScript `pnpm` monorepo with clear package boundaries:

- `artifacts/api-server`: Express API, RSS sync, MCP server, and data routes.
- `artifacts/datagen-explorer`: React/Vite frontend.
- `lib/db`: PostgreSQL schema and Drizzle setup.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated client and validation
  artifacts.
- `scripts`: local and build-time utility scripts.

The core data model stores podcast episodes in PostgreSQL, with JSONB arrays for
recommendations, chapters, and related links, plus text arrays for themes and
tools. This keeps the episode record compact while still allowing filtering and
aggregation.

The app was designed to support both a dynamic API/PostgreSQL setup and a
static production setup. The dynamic path is useful for local development and
future server-backed deployments. The current production path is static on
Netlify.

The production pivot to static was a key decision. Instead of requiring a live
Express server and PostgreSQL database at runtime, Netlify generates a static
catalog during the build. The frontend then emulates the relevant `/api` routes
from that generated JSON file.

RSS parsing is multi-podcast, not DataGen-only. The configured feeds include
DataGen, The Analytics Engineering Podcast, Lenny's Podcast, and AI Engineering
Podcast. Non-DataGen episode IDs are prefixed with their podcast slug to avoid
collisions.

Theme extraction uses a closed taxonomy. If configured provider keys are
available, the app tries Gemini, then Anthropic, then the OpenAI-compatible
integration. If none work, it falls back to local keyword heuristics. This keeps
sync usable even without AI credentials.

Resources are aggregated from episode recommendations. URLs are normalized,
tracking parameters are stripped, noisy links are filtered, and weak titles such
as "ici", "link", bare domains, or opaque IDs are replaced with more readable
labels where possible.

## Blockers and Resolutions

Local setup needed to be predictable. The API expects an explicit `PORT`,
the database connection comes from the root `.env`, and the frontend proxies
`/api` requests to the API server. The stable local convention is API on
`19899` and Vite on `5173`.

Array filters in PostgreSQL were tricky. Raw SQL array overlap expressions could
produce the wrong shape when combined with Drizzle parameters. The fix was to
use Drizzle's `arrayOverlaps()` helper for `themes` and `tools` filters.

Netlify production could not rely on a long-running Express API and PostgreSQL
database within a simple static hosting model. The solution was the static
catalog pipeline: fetch RSS feeds at build time, write `static-data.json`, then
serve all frontend data from that file.

The data contained a lot of resource noise: tracking links, podcast platform
links, privacy links, generic anchor text, duplicate URLs, and shortlinks. The
resource aggregation layer now normalizes URLs, removes known noisy domains and
patterns, canonicalizes known podcast resources, and derives better titles from
URLs or episode context.

Theme extraction could fail or be unavailable depending on credentials and
provider availability. The extractor now degrades gracefully through configured
providers and ultimately falls back to deterministic local inference.

Search and filters needed to behave consistently in both dynamic API mode and
static mode. The frontend API client intercepts `/api` requests when
`VITE_STATIC_DATA_URL` is configured, so the same UI can work against either a
real API or the generated static catalog.

## Local Setup

Install dependencies with `pnpm`:

```bash
pnpm install
```

Create a root `.env` with at least:

```bash
DATABASE_URL="postgres://USER:PASSWORD@localhost:5432/podcast_data_miner"
```

Push the Drizzle schema:

```bash
pnpm --filter @workspace/db push
```

Run the API:

```bash
PORT=19899 pnpm --filter @workspace/api-server dev
```

Run the frontend:

```bash
PORT=5173 pnpm --filter @workspace/datagen-explorer dev
```

The frontend proxies `/api` to `http://localhost:19899` by default.

## Production Data Flow

Production is currently static on Netlify.

Netlify runs:

```bash
pnpm run refresh:static && pnpm run build:static
```

`refresh:static` runs `scripts/src/generate-static-data.ts`. It fetches the
configured RSS feeds, parses episodes, extracts recommendations, chapters,
related links, themes, and tools, aggregates resources, then writes:

```text
artifacts/datagen-explorer/public/static-data.json
```

`build:static` sets:

```bash
VITE_STATIC_DATA_URL=static-data.json
```

When this variable is present, the frontend configures the generated API client
to load the static catalog. Browser requests to `/api/episodes`,
`/api/resources`, `/api/themes`, `/api/tools`, `/api/podcasts`, `/api/stats`,
and sync status endpoints are answered from the local JSON file instead of a
runtime server.

To refresh production data, trigger a new Netlify build. A Git-based alternative
is to run `pnpm run refresh:static` locally, commit the generated
`static-data.json`, and configure Netlify to only run the frontend static build.
