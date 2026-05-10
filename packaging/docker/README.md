# Hardlink Organizer — Docker (canonical)

This directory is the **canonical build source** for the Hardlink Organizer
container image. All platform-specific packaging directories reference this
Dockerfile and entrypoint script.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-platform image definition (Python 3.11-slim + gosu) |
| `entrypoint.sh` | Privilege-drop entry point — remaps PUID/PGID at startup |
| `docker-compose.yml` | Generic compose example for any Linux Docker host |

## Building

Always build from the **repository root** so the `COPY` instructions in the
Dockerfile can reach the application source:

```bash
# From the Hardlink Organizer root
docker build -f packaging/docker/Dockerfile -t hardlink-organizer:v1.0.0-rc.1 .
```

## Running (generic)

```bash
docker compose -f packaging/docker/docker-compose.yml up -d
```

Adjust volume paths in `docker-compose.yml` to match your host layout before
the first start.

## Platform-specific compose files

Each platform directory under `packaging/` contains a compose file (or stack
definition) tailored to that platform's path conventions:

| Platform | Compose file |
|---|---|
| Unraid | `packaging/unraid/docker-compose.yml` |
| TrueNAS SCALE | `packaging/truenas/docker-compose.yml` |
| OpenMediaVault | `packaging/omv/docker-compose.yml` |
| Portainer | `packaging/portainer/stack.yml` |

## PUID / PGID

Set `PUID` and `PGID` environment variables to match your host user to avoid
permission mismatches on mounted volumes:

```bash
id -u   # → use as PUID
id -g   # → use as PGID
```

## Published image

Once published via GitHub Actions, the image is available from GHCR:

```bash
docker pull ghcr.io/starlightdaemon/hardlink-organizer:latest
```

See `packaging/unraid/README.md` for the full GitHub Actions publishing workflow.
