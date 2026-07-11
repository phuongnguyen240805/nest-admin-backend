#!/usr/bin/env bash
# Run Instatic from the monorepo clone with Ladipage-safe ports.
# CMS API:  http://127.0.0.1:8787
# Admin UI: http://127.0.0.1:5174
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
INSTATIC_DIR="${INSTATIC_DIR:-$ROOT/Instatic}"

if [[ ! -d "$INSTATIC_DIR" ]]; then
  echo "Instatic repo not found at: $INSTATIC_DIR" >&2
  echo "Set INSTATIC_DIR=/path/to/Instatic" >&2
  exit 1
fi

export PORT="${PORT:-8787}"
export VITE_PORT="${VITE_PORT:-5174}"
# SQLite default if unset (Instatic dev script also defaults this)
export DATABASE_URL="${DATABASE_URL:-sqlite:./.tmp/dev.db}"

echo "[ladipage-instatic] CMS  PORT=$PORT  → http://127.0.0.1:${PORT}"
echo "[ladipage-instatic] Vite VITE_PORT=$VITE_PORT → http://127.0.0.1:${VITE_PORT}"
echo "[ladipage-instatic] dir  $INSTATIC_DIR"
echo ""
echo "Nest: INSTATIC_MOCK=false INSTATIC_BASE_URL=http://127.0.0.1:${PORT}"
echo "FE:   NEXT_PUBLIC_LANDING_EDITOR=instatic INSTATIC_REWRITE_TARGET=http://127.0.0.1:${VITE_PORT}"
echo ""

cd "$INSTATIC_DIR"
if [[ ! -d node_modules ]]; then
  bun install
fi
exec bun run dev
