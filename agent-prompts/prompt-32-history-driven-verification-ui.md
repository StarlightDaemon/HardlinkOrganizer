# Prompt 32: History-Driven Verification UI

Recommended model:
- Gemini 3.1 Pro (high)

Recommended mode:
- planning on

## Goal

Do the next bounded `0.3.x` slice for Hardlink Organizer verification by adding
an operator-facing web UI for the verification backend that already exists.

This pass should stay focused on verification driven by existing link-history
records. Do not widen into manual-path verification, destination management, or
other roadmap work.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `agent-ledger/CURRENT_STATE.md`
2. `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`
3. `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`
4. `./README.md`
5. `./webapp/app.py`
6. `./webapp/models.py`
7. `./webapp/static/app.js`
8. `./webapp/static/style.css`
9. `./webapp/templates/index.html`
10. `./tests/test_webapp.py`

Then read only the files directly relevant to your implementation.

## Problem statement

The verification backend is in place:

- `POST /api/verify`
- `GET /api/verify/{run_id}`
- `GET /api/verify/{run_id}/export.json`
- `GET /api/verify/{run_id}/export.csv`

But the hosted web UI still has no operator-facing path to use it. The current
frontend state machine covers the link workflow and shows recent history, yet
there is no way to:

- trigger verification from a prior non-dry-run link job
- inspect the stored verification results in the browser
- download the existing JSON or CSV exports from the UI

That makes `0.3.0` verification effectively backend-only.

## Required outcome

Implement a bounded verification UX in the existing web app that lets an
operator verify a prior link-history job from the browser and review the stored
results without leaving the current product boundary.

## Scope

Do:

- add a verification entry point in the existing history-driven UI
- allow verification only for real link-history rows, not dry-run rows
- show clear loading, success, and failure states for verification requests
- display stored verification summary counts and per-file result rows
- surface export actions for JSON and CSV from the UI
- keep the workflow aligned with the current backend contract:
  - `mode = "link_history"`
  - `link_history_id = <id>`
- add or update the most relevant tests you can
- update README usage notes if the browser verification workflow becomes
  materially more discoverable or changes operator guidance

Do not:

- add manual-path verification mode
- add source-set or destination-set verification mode
- redesign the current backend verification storage
- widen into destination management, naming cleanup, or CA work
- rebuild the whole frontend or replace the existing workflow model

## Minimum expected implementation

### History integration

Use the existing recent-operations history as the entry point for this slice.

At minimum:

- each eligible non-dry-run history item should offer a `Verify` action
- dry-run history rows should not pretend they can be verified
- if helpful, show a small reason such as `Dry run only`

### Verification result display

Add a browser-visible verification results view that can show:

- run id
- linked job context
- created time
- summary counts by status
- a per-file result table or list
- result status and notes

The UI can be:

- a dedicated verification panel in the main content area
- or a history-adjacent details view

Either is acceptable if it is clear, low-risk, and fits the current app shape.

### Exports

Provide obvious UI affordances to download:

- JSON export
- CSV export

Use the existing export endpoints. Do not reimplement export generation in the
frontend.

### Result filtering

If you can add one bounded usability improvement cleanly, prefer lightweight
filtering such as:

- failures only
- unverified only
- status dropdown

This is optional. Do not overbuild it.

## Design guidance

- keep this pass history-driven because the backend only supports link-history
  verification today
- preserve the current preview-first, audit-friendly product posture
- make it obvious when a verification run is still loading or has failed
- prefer explicit copy over overly clever UI
- do not hide the distinction between:
  - verified hardlinks
  - files that exist but are not hardlinked
  - files that cannot be verified cleanly
- keep the state model easy to extend later if manual or set-pair verification
  modes are added

## Suggested implementation areas

- `webapp/static/app.js`
- `webapp/static/style.css`
- `webapp/templates/index.html`
- `webapp/models.py` only if needed for any response wiring
- `webapp/app.py` only if small backend affordances are needed
- `tests/test_webapp.py`
- `README.md`

## Validation

Run the most relevant local tests you can.

At minimum, attempt:

- `python3 -m unittest discover -s ./tests -v`

If `pytest` is practical in your environment, include it.

If frontend behavior cannot be meaningfully covered by automated tests in this
repo, say so clearly and describe the manual browser checks you performed.

## Final response requirements

- list changed files
- summarize the verification UI added
- state how verification is triggered from history
- summarize any export or filtering affordances added
- state what tests or manual verification you ran
- call out remaining gaps before the broader multi-mode verification feature is
  complete
