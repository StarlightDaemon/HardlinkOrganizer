#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting Hardlink Organizer with PUID=${PUID} PGID=${PGID}"

groupmod -g "$PGID" hlo
usermod  -u "$PUID" -g "$PGID" hlo

chown -R hlo:hlo /config /data

exec gosu hlo "$@"
