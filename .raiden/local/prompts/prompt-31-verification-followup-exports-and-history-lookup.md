# Prompt 31: Verification Follow-Up Exports and History Lookup

Recommended model:
- Gemini 3.1 Pro (high)

Recommended mode:
- planning on

## Goal

Do the next bounded repo-local follow-up to the `0.3.0` verification foundation.

This pass should harden and extend the new verification backend without widening
into a full UI build or another real Unraid validation cycle.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`
2. `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`
3. `./README.md`
4. `./engine/db.py`
5. `./engine/verification.py`
6. `./webapp/app.py`
7. `./webapp/models.py`
8. `./tests/test_engine_db.py`
9. `./tests/test_verification.py`
10. `./tests/test_webapp.py`

Then read only the files directly relevant to the implementation you choose.

## Problem statement

The first verification slice is in place, but two obvious follow-ups remain:

- `POST /api/verify` finds one `link_history` row by loading a large history list
  and filtering it in Python instead of using a direct database lookup
- verification results cannot yet be exported as JSON or CSV for audit or review

These are good repo-local follow-ups because they improve correctness and
operability without requiring a new frontend flow or Unraid host session.

## Required outcome

Implement a bounded verification follow-up that:

- adds direct lookup of one `link_history` row by id in the database layer
- updates verification triggering to use that direct lookup
- adds export endpoints for stored verification runs
- adds or updates focused tests for the new DB and API behavior

## Scope

Do:

- add `get_link_history_record(history_id)` or equivalent DB helper
- update `POST /api/verify` to use that helper instead of scanning all history
- add `GET /api/verify/{run_id}/export.json`
- add `GET /api/verify/{run_id}/export.csv`
- keep exports based on persisted verification results, not re-derived live output
- add tests for:
  - direct history lookup
  - export endpoint success
  - export endpoint 404 behavior
  - basic CSV shape and header expectations
- update docs if the API surface changes materially

Do not:

- build the Verification tab
- add manual-path or set-pair verification modes
- redesign verification storage
- broaden into destination management, naming cleanup, or CA work
- require another real Unraid validation pass for this slice

## Minimum expected implementation

### Database

Add one focused helper for direct retrieval of a single `link_history` record by id.

Requirements:

- return `dict | None`
- preserve the same field names used by existing history consumers
- do not widen into a general query builder or larger DB refactor

### API hardening

Update:

- `POST /api/verify`

So that it:

- uses direct DB lookup for `link_history_id`
- returns 404 when the record does not exist
- keeps the current narrow mode contract:
  - only `mode = "link_history"` is accepted

### Export endpoints

Add:

- `GET /api/verify/{run_id}/export.json`
- `GET /api/verify/{run_id}/export.csv`

Requirements:

- both exports use persisted run and result rows
- JSON export should include:
  - run metadata
  - summary counts
  - result rows
- CSV export should include one row per result
- include enough columns to support audit use:
  - source path
  - candidate destination
  - source and destination dev or inode fields
  - source and destination nlink fields
  - status
  - notes
- return 404 when `run_id` does not exist

### Tests

Add or update tests that prove:

- direct DB lookup works
- verification trigger still works with the new lookup path
- JSON export returns the expected structure
- CSV export returns a parseable CSV with stable headers
- missing verification runs return 404 on export routes

## Design guidance

- keep this pass backend-first and pragmatic
- do not recompute verification results during export
- prefer simple response shapes over over-engineered abstractions
- keep export naming and content audit-friendly
- stay compatible with the current verification foundation instead of refactoring it

## Suggested implementation areas

- `engine/db.py`
- `webapp/app.py`
- `webapp/models.py` only if needed
- `tests/test_engine_db.py`
- `tests/test_webapp.py`
- `README.md` if API docs need updating

## Validation

Run the most relevant local tests you can.

At minimum, attempt:

- `python3 -m unittest discover -s ./tests -v`

If a fuller `pytest` run is practical in your environment, include it.

If web dependencies are missing, say so clearly and still run the DB or engine
tests that apply.

## Final response requirements

- list changed files
- summarize the history-lookup and export changes
- summarize any API additions or behavior changes
- state what tests or verification you ran
- call out remaining gaps before the broader verification feature is complete
