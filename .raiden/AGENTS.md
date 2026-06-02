# Hardlink Organizer — Agent Startup

Read `.raiden/README.md` before doing any repo-local work. It describes the
RAIDEN Instance control plane for this repo.

## Authoritative workspace root

- WSL path: `/mnt/e/HardlinkOrganizer`
- Windows path: `E:\HardlinkOrganizer`
- Deprecated nested path: `E:\StarlightDaemonDev\tools\internal\hardlink-organizer`

Treat `/mnt/e/HardlinkOrganizer` as the only live project root. If your
context points at the deprecated nested copy, stop and switch back here before
doing anything.

## Control plane

The RAIDEN Instance control plane lives under `.raiden/`:

- `.raiden/state/CURRENT_STATE.md` — live project snapshot
- `.raiden/state/OPEN_LOOPS.md` — the only entry point for new execution work
- `.raiden/state/GOALS.md` — current and near-term goals
- `.raiden/state/DECISIONS.md` — durable decision record
- `.raiden/state/WORK_LOG.md` — session history
- `.raiden/local/prompts/` — bounded agent prompt slices

## First files to read

1. `README.md` — product brief, current version, run commands, API surface, config model
2. `.raiden/state/CURRENT_STATE.md` — evidence-based current project snapshot
3. `.raiden/state/OPEN_LOOPS.md` — bounded work entry point
4. `notes/README.md` — index of planning and roadmap notes
5. `packaging/unraid/README.md` — Unraid mount layout, Docker hosting, release packaging
6. `.raiden/local/prompts/README.md` — narrow prompts for handing a slice to another agent

## Code entry points

- `hardlink_organizer.py` — CLI entry point
- `webapp/app.py` — FastAPI app and routes
- `webapp/run.py` — local web server launcher
- `engine/db.py` — persisted scan and link history
- `engine/verification.py` — verification-run backend

## Tests

- `tests/` — unit, integration, and smoke coverage for CLI, web app, DB, and verification flows

## Working assumptions

- Treat this folder as the local source of truth for product, roadmap, packaging, prompts, and state.
- The `.raiden/state/` control plane is authoritative for project continuity. The retired `agent-ledger/` is preserved in git history only.
- Do not run new work from the deprecated nested copy under `StarlightDaemonDev`.
