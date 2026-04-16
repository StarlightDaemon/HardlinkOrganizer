# Hardlink Organizer Agent Guide

This directory is intended to be workable as its own agent-facing project
workspace.
Start here before chasing parent-repo context.

## First files to read

1. `README.md`
   - Product brief, current version, run commands, API surface, and config model.
2. `agent-ledger/README.md`
   - Project-local control plane and ledger file map.
3. `agent-ledger/CURRENT_STATE.md`
   - Evidence-based current project snapshot.
4. `agent-ledger/OPEN_LOOPS.md`
   - The only entry point for new execution work.
5. `notes/README.md`
   - Index of tool-local planning and roadmap notes.
6. `packaging/unraid/README.md`
   - Unraid mount layout, Docker hosting model, and release packaging details.
7. `agent-prompts/README.md`
   - Narrow prompts for handing one bounded slice to another agent.

## Code entry points

- `hardlink_organizer.py`: CLI entry point.
- `webapp/app.py`: FastAPI app and routes.
- `webapp/run.py`: local web server launcher.
- `engine/db.py`: persisted scan and link history.
- `engine/verification.py`: verification-run backend.

## Tests

- `tests/`: unit, integration, and smoke coverage for CLI, web app, DB, and verification flows.

## Working assumptions

- Treat this folder as the local source of truth for product, roadmap, packaging, prompts, and ledger state.
- Prefer this project's `agent-ledger/` over repo-level summaries when they disagree.
- Only reach into repo-level docs when you need cross-repo governance, inventory, or parent-repo catalog context.

## Repo-level files that may still matter

- `../../../../agent-ledger/CURRENT_STATE.md`
- `../../../../agent-ledger/OPEN_LOOPS.md`
- `../../../../docs/tool-catalog.md`

Their Hardlink Organizer content is now summary material only. The primary
control plane for this project lives under `./agent-ledger/`.
