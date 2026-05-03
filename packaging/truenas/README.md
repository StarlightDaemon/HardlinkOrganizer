# Hardlink Organizer — TrueNAS SCALE

This directory contains packaging assets for deploying Hardlink Organizer on
**TrueNAS SCALE** using Docker Compose or the built-in Apps framework.

The canonical Docker image is defined in `packaging/docker/Dockerfile`.

## Prerequisites

- TrueNAS SCALE 24.x or later with Docker Compose support
- A pool or dataset for config and data (e.g. `tank/apps/hardlink-organizer`)
- Source and destination datasets on the **same pool** to avoid cross-device
  hardlink failures

## Quick start

1. Copy `config.example.toml` from the repository root to your TrueNAS config
   dataset and edit it to match your dataset paths.

2. Adjust volume paths in `docker-compose.yml` to match your TrueNAS pool layout.

3. Deploy:

```bash
docker compose -f packaging/truenas/docker-compose.yml up -d
```

## Mount layout

Source and destination datasets **must** reside on the same pool (same underlying
ZFS vdev) so that hardlinks can cross directories without hitting a device boundary.

```toml
[source_sets]
movies = "/mnt/src/movies"

[dest_sets]
movies = "/mnt/dst/movies"
```

Both paths must map into the **same pool** mount inside the container.

## PUID / PGID

Set `PUID` / `PGID` to match the TrueNAS user that owns the datasets:

```bash
# On the TrueNAS shell
id <your-user>
```

## Access

Open: `http://<truenas-ip>:7700`
