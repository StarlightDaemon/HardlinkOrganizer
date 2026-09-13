# Hardlink Organizer — Packaging

This directory contains all packaging assets for deploying Hardlink Organizer
across supported platforms.

## Structure

```
packaging/
├── docker/          Canonical Docker image (Dockerfile + entrypoint)
├── unraid/          Unraid-specific compose, templates, and CA submission assets
├── truenas/         TrueNAS SCALE deployment guide and compose file
├── omv/             OpenMediaVault deployment guide and compose file
└── portainer/       Portainer stack definition
```

## Canonical Docker image

The image is published to Docker Hub, the sole actively maintained registry:

```bash
docker pull starlightdaemon/hardlink-organizer:latest
```

Older images remain available at `ghcr.io/starlightdaemon/hardlink-organizer`
as a historical artifact, but GHCR is no longer an actively maintained
publication target.

To build locally from source, see [`packaging/docker/README.md`](docker/README.md).

## Platform guides

| Platform | Guide | Compose / Stack |
|---|---|---|
| Generic Docker host | [docker/README.md](docker/README.md) | [docker/docker-compose.yml](docker/docker-compose.yml) |
| Unraid | [unraid/README.md](unraid/README.md) | [unraid/docker-compose.yml](unraid/docker-compose.yml) |
| TrueNAS SCALE | [truenas/README.md](truenas/README.md) | [truenas/docker-compose.yml](truenas/docker-compose.yml) |
| OpenMediaVault | [omv/README.md](omv/README.md) | [omv/docker-compose.yml](omv/docker-compose.yml) |
| Portainer | [portainer/README.md](portainer/README.md) | [portainer/stack.yml](portainer/stack.yml) |

## Published image

Built and published automatically by `.github/workflows/hardlink-organizer-image.yml`
on every version tag. Pushed to Docker Hub only.

## Key considerations for all platforms

- **Source and destination must share the same underlying device.** Hardlinks
  cannot cross device boundaries (`EXDEV`). Mount a shared parent path rather
  than separate source and destination directories wherever possible.
- **PUID / PGID** — set these environment variables to your host user's UID/GID
  to avoid permission mismatches on host-mounted volumes.
- **Config is always host-mounted** — the container never writes to its own
  image layer. Config, DB, and logs all live on the host.
