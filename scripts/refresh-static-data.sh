#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

echo "Refreshing static podcast data..."
pnpm run refresh:static

echo "Validating static frontend build..."
pnpm run build:static

echo "Done."
