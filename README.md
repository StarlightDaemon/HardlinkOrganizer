# Hardlink Organizer

> Local-first hardlink planning for messy ingress folders, with preview-first
> workflow and source-safe linking.

Hardlink Organizer is a local project for browsing ingress folders and
hardlinking selected items into library destinations without moving or renaming
the source.

This repository is currently a working project and a GitHub test home for
iterating on the app, packaging, and workflow. It is not being presented as a
fully polished public release.

[`Quick Start`](#quick-start) · [`Workflow`](#workflow-shape) · [`Repo Map`](#repository-map) · [`More Detail`](#more-detail)

## At A Glance

| Area | Current State |
| --- | --- |
| Version | `0.3.0` |
| Status | `verification foundation` |
| Primary target | `Docker — Unraid, TrueNAS, OMV, and generic Linux` |
| Interface | hosted web UI with CLI fallback |
| Safety stance | preview-first, source-safe, same-device validation |

## What It Does

- scans configured source sets
- shows a browser UI for selecting what to link
- previews source and destination paths before writing
- validates same-device compatibility before hardlinking
- records scan, link, and verification history in SQLite
- supports CLI fallback alongside the web app

## Workflow Shape

1. Scan a configured source set.
2. Browse items in the web UI or CLI.
3. Preview the proposed destination path and validation results.
4. Link only after the plan looks correct.
5. Review history and verification output afterward.

## Quick Start

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the web app:

```bash
python3 ./webapp/run.py --config ./config.toml --port 7700
```

Open:

```text
http://localhost:7700
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
| `hardlink_organizer.py` | CLI entry point |
| `webapp/app.py` | FastAPI routes |
| `webapp/run.py` | local web launcher |
| `engine/db.py` | state and history persistence |
| `engine/verification.py` | verification backend |

## Repository Map

| Path | Role |
| --- | --- |
| `engine/` | core hardlink, DB, and verification logic |
| `webapp/` | FastAPI app, templates, and static assets |
| `tests/` | unit, integration, and route-harness coverage |
| `packaging/` | Docker and platform packaging (Unraid, TrueNAS, OMV, Portainer) |
| `.raiden/state/` | project continuity, decisions, and open loops |
| `.raiden/local/prompts/` | bounded prompts for agent execution |
| `notes/` | planning, roadmap, and validation notes |
| `notes/plans/` | older implementation and release plans that no longer need root placement |

## Notes

- Source files are meant to stay in place.
- Preview-first behavior is the default expectation.
- Docker and platform packaging notes live under `packaging/`.
- Project planning and continuity docs live under `.raiden/state/` and `notes/`.

## More Detail

- Packaging notes: `packaging/README.md`
- Project state: `.raiden/state/CURRENT_STATE.md`
- Open work: `.raiden/state/OPEN_LOOPS.md`
- Planning notes: `notes/README.md`
- Active prompts: `.raiden/local/prompts/README.md`
