#!/usr/bin/env sh
set -eu
network="${LIORA_PLATFORM_NETWORK:-liora-platform}"
if ! docker network inspect "$network" >/dev/null 2>&1; then
  docker network create "$network" >/dev/null
  echo "Created Docker network: $network"
else
  echo "Docker network already exists: $network"
fi
