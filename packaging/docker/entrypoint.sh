#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting Hardlink Organizer with PUID=${PUID} PGID=${PGID}"

chown -R "${PUID}:${PGID}" /config /data

exec gosu "${PUID}:${PGID}" "$@"
