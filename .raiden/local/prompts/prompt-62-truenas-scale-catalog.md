# Prompt 62: TrueNAS SCALE 1.0 — Native Catalog (LOOP-013)

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off

## Goal

Get Hardlink Organizer installable natively through the TrueNAS SCALE Apps UI
by submitting to the TrueNAS community apps catalog. Users should be able to
find and install HLO from the Apps section of the TrueNAS SCALE web interface
without touching a shell.

## Background

TrueNAS SCALE 24.10 (ElectricEel) and later replaced the Kubernetes-based app
system with a Docker Compose-based one. The community catalog lives at:

  https://github.com/truenas/apps

Apps are submitted via pull request. Each app is a directory under
`ix-dev/community/<app-name>/` containing:

- `app.yaml` — metadata (name, description, version, icon, categories, etc.)
- `docker-compose.yml` — the actual container definition
- `README.md` — shown in the SCALE UI app detail view
- `migrations/` — optional upgrade helpers

The SCALE UI reads these at catalog sync time. Once a PR is merged to
`truenas/apps`, the app appears in the SCALE Apps → Available Applications list.

## Dependency

LOOP-011 (prompt-60) must be complete. The canonical image reference must be
confirmed before writing the `app.yaml`.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `.raiden/state/CURRENT_STATE.md`
2. `packaging/truenas/README.md`
3. `packaging/truenas/docker-compose.yml`
4. `packaging/docker/Dockerfile`

## Steps

### Step 1 — Research the current truenas/apps submission format

- Clone or browse `https://github.com/truenas/apps`
- Find an existing simple community app (e.g. a small web UI tool) as a reference
- Confirm the current required shape of `app.yaml` and `docker-compose.yml`
- Note any submission guidelines in `CONTRIBUTING.md` or `docs/`

### Step 2 — Build the app definition

Create the app directory at `packaging/truenas/catalog/` containing:

**`app.yaml`** (minimum required fields):
```yaml
app_version: "1.0.0"
capabilities: []
categories:
  - storage
  - utilities
description: Hardlink Organizer — manage media hardlinks across NAS shares via a browser UI
home: https://github.com/StarlightDaemon/HardlinkOrganizer
host_mounts: []
icon: https://raw.githubusercontent.com/StarlightDaemon/HardlinkOrganizer/main/packaging/unraid/assets/icon.png
keywords:
  - hardlink
  - media
  - nas
  - storage
lib_version: "2.1.0"
lib_version_hash: <fill from reference app>
run_as_context:
  - description: Hardlink Organizer runs as a configurable user via PUID/PGID
    gid: 568
    group_name: apps
    uid: 568
    user_name: apps
title: Hardlink Organizer
train: community
version: 1.0.0
```

**`docker-compose.yml`** — adapt from `packaging/truenas/docker-compose.yml`.
Key requirements for SCALE catalog apps:
- Use `ix-` prefixed network names for SCALE compatibility
- Reference the GHCR image: `ghcr.io/starlightdaemon/hardlink-organizer:latest`
- Expose config and data volumes as named volumes with correct labels
- PUID/PGID env vars must be present

**`README.md`** — install guide shown in SCALE UI. Include:
- One-paragraph description
- Mount layout requirements (same pool for source and dest)
- PUID/PGID guidance
- Access URL format

### Step 3 — Validate on a TrueNAS SCALE host

- Copy the catalog entry structure to a local directory on the TrueNAS host
- Use the SCALE "Custom Apps" path to test the compose definition before
  submitting to the catalog:
  - Apps → Discover Apps → Custom App → paste compose content
- Verify:
  - Container starts
  - Web UI reachable at `http://<truenas-ip>:7700`
  - Config and data mounts persist
  - PUID/PGID remapping works

Record any issues and fix the compose or app.yaml before submitting.

### Step 4 — Fork and submit to truenas/apps

- Fork `https://github.com/truenas/apps`
- Add `ix-dev/community/hardlink-organizer/` with the files from Step 2
- Open a PR against `truenas/apps` main branch
- PR title format: `community: add hardlink-organizer`
- Follow any contribution checklist in the repo

Exit: PR open and link recorded.

### Step 5 — Post-submission follow-up

- Monitor PR for review feedback
- Respond to any requested changes
- Once merged: confirm app appears in SCALE Apps on a real host after catalog sync
- Verify install-from-catalog works end-to-end

## Exit criteria

- `packaging/truenas/catalog/` directory exists with `app.yaml`, `docker-compose.yml`, and `README.md`
- App validated via SCALE Custom Apps on a real TrueNAS SCALE host
- PR submitted to `truenas/apps`
- PR merged and app installable from the SCALE Apps UI

## Update CURRENT_STATE when done

Mark LOOP-013 complete and record the catalog PR URL and merged status.
