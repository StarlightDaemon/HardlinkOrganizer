# Hardlink Organizer

Hardlink Organizer is a local-first tool for browsing ingress folders and
hardlinking selected items into library destinations without moving or renaming
the source.

This repository is currently a working local project and a GitHub test home for
iterating on the app, packaging, and workflow. It is not being presented as a
fully polished public release.

## What It Does

- scans configured source sets
- shows a browser UI for selecting what to link
- previews source and destination paths before writing
- validates same-device compatibility before hardlinking
- records scan, link, and verification history in SQLite
- supports CLI fallback alongside the web app

## Current State

- Version: `0.3.0`
- Status: `verification foundation`
- Primary target: `local / Unraid-oriented testing`
- Interface: `hosted web UI` with `CLI fallback`

## Quick Start

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the web app:

```bash
python ./webapp/run.py --config ./config.toml --port 7700
```

Open:

```text
http://localhost:7700
```

Run the CLI:

```bash
python ./hardlink_organizer.py --config ./config.toml scan
```

Run tests:

```bash
python -m pytest ./tests/
```

## Project Shape

Main entry points:

- `hardlink_organizer.py` — CLI entry point
- `webapp/app.py` — FastAPI routes
- `webapp/run.py` — local web launcher
- `engine/db.py` — state and history persistence
- `engine/verification.py` — verification backend

## Notes

- Source files are meant to stay in place.
- Preview-first behavior is the default expectation.
- Unraid and Docker packaging notes still live under `packaging/unraid/`.
- Deeper project planning and continuity docs live under `agent-ledger/` and
  `notes/`.

## If You Need More Detail

- Packaging notes: `packaging/unraid/README.md`
- Project state: `agent-ledger/CURRENT_STATE.md`
- Open work: `agent-ledger/OPEN_LOOPS.md`
