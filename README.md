# Podcast Data Miner

Application de collecte et d'exploration des episodes du podcast DataGen.

Le projet synchronise le flux RSS DataGen dans une base PostgreSQL, extrait les ressources citees dans les descriptions, classe les episodes par themes, puis expose le tout via une API Express et une interface React.

## Stack

- Monorepo `pnpm`
- TypeScript
- API Express dans `artifacts/api-server`
- Frontend React/Vite dans `artifacts/datagen-explorer`
- PostgreSQL + Drizzle dans `lib/db`
- Contrat OpenAPI dans `lib/api-spec`
- Clients/types generes dans `lib/api-client-react` et `lib/api-zod`

## Prerequis

- Node.js recent
- `pnpm`
- Une base PostgreSQL accessible en local ou distante

Le repo bloque volontairement `npm` et `yarn`: utilisez `pnpm`.

## Installation

```bash
pnpm install
```

## Configuration

Creer un fichier `.env` a la racine du projet avec au minimum:

```bash
DATABASE_URL="postgres://USER:PASSWORD@localhost:5432/podcast_data_miner"
```

Variables utiles:

```bash
# API
PORT=19899
DATABASE_URL="postgres://USER:PASSWORD@localhost:5432/podcast_data_miner"
LOG_LEVEL=info

# Frontend Vite
API_BASE_URL=http://localhost:19899

# Extraction IA des themes, optionnel
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-5-haiku-latest

AI_INTEGRATIONS_OPENAI_BASE_URL=...
AI_INTEGRATIONS_OPENAI_API_KEY=...
```

Les cles IA sont optionnelles. Sans elles, l'API retombe sur une extraction locale heuristique des themes.

## Initialiser la base

Une fois `DATABASE_URL` configure:

```bash
pnpm --filter @workspace/db push
```

Cette commande applique le schema Drizzle dans PostgreSQL.

## Lancer le projet en local

Ouvrir deux terminaux.

Terminal 1: lancer l'API sur le port attendu par le frontend.

```bash
PORT=19899 pnpm --filter @workspace/api-server dev
```

Terminal 2: lancer l'interface.

```bash
PORT=5173 pnpm --filter @workspace/datagen-explorer dev
```

L'application est ensuite disponible sur:

```text
http://localhost:5173
```

Le frontend proxy automatiquement les appels `/api` vers `http://localhost:19899`.

## Synchroniser les episodes

Depuis l'interface, utiliser le bouton de synchronisation RSS.

On peut aussi declencher la synchro en HTTP:

```bash
curl -X POST http://localhost:19899/api/sync \
  -H "Content-Type: application/json" \
  -d '{"extractThemes": true}'
```

Suivre l'etat de la synchro:

```bash
curl http://localhost:19899/api/sync/status
```

Options du body:

- `extractThemes`: lance l'extraction des themes, `true` par defaut.
- `force`: force la re-extraction des themes pour les episodes deja traites.

Pour importer rapidement les episodes sans extraction IA:

```bash
curl -X POST http://localhost:19899/api/sync \
  -H "Content-Type: application/json" \
  -d '{"extractThemes": false}'
```

## Commandes utiles

```bash
# Typecheck complet
pnpm run typecheck

# Build complet
pnpm run build

# Build API seulement
pnpm --filter @workspace/api-server build

# Build frontend seulement
pnpm --filter @workspace/datagen-explorer build

# Regenerer les clients/types depuis l'OpenAPI
pnpm --filter @workspace/api-spec codegen
```

## API

L'API est servie sous `/api`.

Endpoints principaux:

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

Le contrat OpenAPI se trouve dans `lib/api-spec/openapi.yaml`.

## Structure du repo

```text
artifacts/
  api-server/          API Express + routes + synchronisation RSS
  datagen-explorer/   Interface React/Vite
  mockup-sandbox/     Sandbox UI

lib/
  api-spec/           Specification OpenAPI et generation Orval
  api-client-react/   Client React genere
  api-zod/            Schemas Zod generes pour l'API
  db/                 Schema Drizzle et connexion PostgreSQL
  integrations-openai-ai-server/
                       Integration OpenAI cote serveur

scripts/              Scripts utilitaires
```

## Notes de developpement

- Le serveur API `dev` fait un build puis lance `dist/index.mjs`; il ne recharge pas automatiquement a chaque changement.
- La synchro lit le flux RSS DataGen public: `https://feeds.acast.com/public/shows/5fa58959e64011214fbf140d`.
- Les donnees principales sont stockees dans les tables `episodes` et `sync_state`.
- Si l'interface affiche une base vide, lancez une synchro RSS puis rafraichissez l'UI une fois l'etat `done`.
