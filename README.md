# Hardlink Organizer

> Preview-first hardlink planning for NAS ingress folders — browser UI with CLI fallback, source-safe, same-device validated.

Hardlink Organizer scans configured source directories and lets you hardlink selected items into library destinations without moving or renaming the originals. It runs as a lightweight Docker container with a web UI, and works on Unraid, TrueNAS SCALE, OpenMediaVault, and any generic Linux Docker host.

[`Quick Start`](#quick-start) · [`Workflow`](#workflow-shape) · [`Repo Map`](#repository-map) · [`More Detail`](#more-detail)

## At A Glance

| Area | Current State |
| --- | --- |
| Version | `1.0.0` |
| Status | `stable` |
| Primary target | `Docker — Unraid, TrueNAS, OMV, and generic Linux` |
| Interface | hosted web UI with CLI fallback |
| Safety stance | preview-first, source-safe, same-device validation |

## What It Does

- Scans configured source sets and displays items in a browser UI
- Shows a preview of the proposed destination path and validation results before writing
- Validates same-device compatibility before hardlinking
- Links without moving or renaming source files
- Records scan, link, and verification history in SQLite
- Supports CLI fallback alongside the web app

## Workflow Shape

1. Scan a configured source set.
2. Browse items in the web UI.
3. Select an item and choose a destination.
4. Review the preview — source path, destination path, validation results.
5. Execute only after the plan looks correct.
6. Review history and run verification afterward.

> **Security note:** Hardlink Organizer has no authentication. It is designed
> for trusted local or LAN use only. Do not expose port 7700 to the public
> internet or untrusted networks.

## Quick Start

### Docker (recommended)

Pull the image and run with a minimal config:

```bash
# Copy and edit the example config
cp config.example.toml /path/to/config/config.toml

# Run
docker run -d \
  --name hardlink-organizer \
  -p 7700:7700 \
  -v /path/to/config:/config \
  -e PUID=1000 -e PGID=1000 \
  ghcr.io/starlightdaemon/hardlink-organizer:v1.0.0
```

Open `http://localhost:7700`.

For compose-based setups, see the platform-specific files under `packaging/`.

### Local Python

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the web app:

```bash
python3 ./webapp/run.py --config ./config.toml --port 7700
```

Run the CLI:

```bash
python3 ./hardlink_organizer.py --config ./config.toml scan
```

Run tests:

```bash
python3 -m pytest ./tests/
```

## Main Entry Points

| Path | Purpose |
| --- | --- |
| `hardlink_organizer.py` | core logic and CLI entry point |
| `webapp/app.py` | FastAPI routes |
| `webapp/run.py` | web launcher |
| `engine/db.py` | state and history persistence |
| `engine/verification.py` | verification backend |

## Repository Map

| Path | Role |
| --- | --- |
| `engine/` | core hardlink, DB, and verification logic |
| `webapp/` | FastAPI app and React SPA (Vite + Fujin design system) |
| `tests/` | unit, integration, and route-harness coverage |
| `packaging/` | Docker and platform packaging (Unraid, TrueNAS, OMV, Portainer) |
| `docs/` | release reports and agent handoff prompts |
| `config.example.toml` | annotated config reference |

## More Detail

- Platform packaging: `packaging/README.md`
- Docker setup: `packaging/docker/README.md`
- Unraid setup: `packaging/unraid/`
- TrueNAS SCALE setup: `packaging/truenas/`
- OpenMediaVault setup: `packaging/omv/`
- Releases: [github.com/StarlightDaemon/HardlinkOrganizer/releases](https://github.com/StarlightDaemon/HardlinkOrganizer/releases)
