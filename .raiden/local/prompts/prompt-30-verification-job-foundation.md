# Prompt 30: Verification Foundation by Prior Link Job

Recommended model:
- Claude Sonnet 4.6 (thinking)

Recommended mode:
- planning on

## Goal

Do the first bounded implementation slice for Hardlink Organizer hardlink
verification.

This pass should stay repo-local and testable without requiring a real Unraid
host run after every small change. Build the backend and API foundation for
verification using existing link history as the entry point.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`
2. `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`
3. `./README.md`
4. `./hardlink_organizer.py`
5. `./engine/db.py`
6. `./webapp/app.py`
7. `./webapp/models.py`
8. `./tests/test_engine_db.py`
9. `./tests/test_webapp.py`

Then read only the files directly relevant to the implementation you choose.

## Why this slice

The next major roadmap item is hardlink verification, but the full feature is
too wide for one pass.

The best first slice is:

- verification driven by an existing `link_history` job
- persisted verification run and result records
- API endpoints to trigger and inspect verification
- tests for the verification engine and DB behavior

This stays tightly on mission, reuses current data, and is locally testable.

## Problem statement

The app can create hardlinks and record link history, but it cannot yet verify
whether a prior link job actually resulted in true hardlinks at the expected
destination paths.

The next agent should add the first verification capability without widening
into the full multi-mode verification UI.

## Required outcome

Implement a first `0.3.0` verification foundation that can verify prior link
jobs from recorded history and expose the results through the backend.

## Scope

Do:

- add persistent storage for verification runs and per-file verification results
- implement verification for one existing link-history record
- compare source and destination files using real filesystem metadata
- expose API endpoints to create a verification run and fetch its results
- add focused tests for DB, verification logic, and API behavior
- update the README if the API surface or testing workflow materially changes

Do not:

- build the full Verification tab or a large new UI workflow
- implement destination-set or manual-path verification modes
- add naming cleanup or destination management work
- broaden into Community Apps or packaging work
- require a real Unraid validation pass for this slice

## Minimum expected implementation

### Verification behavior

Support verification by prior link-history job id.

Expected flow:

1. look up one `link_history` record
2. derive the expected destination path from that record
3. enumerate source and destination files for the job
4. compare:
   - destination existence
   - `st_dev`
   - `st_ino`
   - `st_nlink`
   - regular-file status
5. store summary and per-file verification results

### Required statuses for this slice

At minimum, support these result states:

- `verified_hardlinked`
- `exists_but_not_hardlinked`
- `missing_at_destination`
- `cannot_verify_permission_error`
- `cannot_verify_symlink`

If you can add one more cleanly:

- `cannot_verify_cross_filesystem`

### Database

Add SQLite tables for:

- `verification_runs`
- `verification_results`

Minimum useful fields:

- run id
- created time
- mode
- source set
- dest set
- link history id
- summary counts
- source path
- candidate dest path
- source device and inode
- dest device and inode
- source and dest link count
- status
- notes

Keep the schema simple and aligned with the existing DB style.

### API

Add:

- `POST /api/verify`
- `GET /api/verify/{run_id}`

For this slice, `POST /api/verify` may accept only one mode:

- `mode = "link_history"`
- `link_history_id = <id>`

That is acceptable and preferred over pretending to support wider modes.

### UI

UI work is optional and should stay minimal.

Acceptable:

- no UI changes at all if the API and tests are solid
- or a tiny history-adjacent affordance only if it is trivial and low-risk

Do not build a large new tab in this pass.

## Design guidance

- treat inode and device match as proof
- do not treat filename matching as proof
- avoid fuzzy heuristics in this first slice
- prefer explicit result records over derived-on-the-fly responses only
- keep the verification code easy to expand later to set-pair and manual modes
- preserve the project’s preview-first, audit-friendly posture

## Suggested implementation areas

- `engine/db.py`
- a new small verification service module if needed
- `webapp/models.py`
- `webapp/app.py`
- tests under `./tests/`

## Validation

Run the most relevant local tests you can.

At minimum, attempt:

- `python3 -m unittest discover -s ./tests -v`

If web dependencies are missing, say so clearly and still run the DB or engine
tests that apply.

## Final response requirements

- list changed files
- summarize the verification foundation added
- summarize any API additions
- state what tests or verification you ran
- call out remaining gaps before full `0.3.0` verification is complete
