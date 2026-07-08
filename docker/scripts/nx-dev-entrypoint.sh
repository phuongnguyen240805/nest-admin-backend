#!/bin/sh
set -e

echo "[nx-dev-entrypoint] Syncing workspace dependencies..."
pnpm install --frozen-lockfile

echo "[nx-dev-entrypoint] Starting: $*"
exec "$@"