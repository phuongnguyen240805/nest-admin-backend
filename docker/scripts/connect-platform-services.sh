#!/bin/sh
set -eu

NETWORK="${LIORA_PLATFORM_NETWORK:-liora-platform}"
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker network create "$NETWORK" >/dev/null
  echo "Created Docker network: $NETWORK"
fi

connect_if_present() {
  container="$1"
  alias="$2"
  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "Skip $container (container not found)"
    return
  fi
  if docker inspect -f "{{if index .NetworkSettings.Networks \"$NETWORK\"}}yes{{else}}no{{end}}" "$container" 2>/dev/null | grep -q '^yes$'; then
    echo "$container already attached to $NETWORK"
    return
  fi
  docker network connect --alias "$alias" "$NETWORK" "$container"
  echo "Connected $container -> $NETWORK (alias: $alias)"
}

connect_if_present libredesk_app libredesk-app
connect_if_present libredesk_zalo_connector zalo-connector
connect_if_present libredesk_facebook_connector facebook-connector
connect_if_present liora-9router 9router

echo ""
echo "Members of $NETWORK:"
docker network inspect "$NETWORK" --format '{{range .Containers}}{{.Name}}{{println}}{{end}}'
