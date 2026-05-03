# Hardlink Organizer — OpenMediaVault (OMV)

This directory contains packaging assets for deploying Hardlink Organizer on
**OpenMediaVault 6+** using the `compose` plugin or any Docker Compose-compatible
workflow.

The canonical Docker image is defined in `packaging/docker/Dockerfile`.

## Prerequisites

- OpenMediaVault 6 or later with the `openmediavault-compose` plugin installed,
  **or** Docker Engine installed directly on the OMV host
- A shared folder for config and data (e.g. `/srv/dev-disk-by-uuid-…/appdata/hardlink-organizer`)
- Source and destination shared folders on the **same physical disk** or the same
  underlying device to avoid cross-device hardlink failures

## Quick start

1. Copy `config.example.toml` to your OMV appdata folder and edit paths.

2. Adjust volume paths in `docker-compose.yml` to match your OMV shared folder
   paths (typically `/srv/dev-disk-by-uuid-<uuid>/…`).

3. Deploy via the OMV Compose plugin UI, or from the shell:

```bash
docker compose -f packaging/omv/docker-compose.yml up -d
```

## Mount layout

Source and destination shared folders **must** reside on the same physical disk
or mdadm array member. Do not route both through `/srv/mergerfs` if that would
span different underlying devices.

## PUID / PGID

Set `PUID` / `PGID` to match the OMV user that owns the shared folders:

```bash
id <your-omv-user>
```

## Access

Open: `http://<omv-ip>:7700`
