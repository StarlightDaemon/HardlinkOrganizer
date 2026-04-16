# Prompt 40: Destination Registry And Validation Backend

Recommended model:
- Gemini 3 Flash
- Gemini 3.1 Pro only if Flash gets blocked on schema or API work

Recommended mode:
- planning off

## Goal

Do the next bounded `LOOP-010` slice for Hardlink Organizer by adding the
backend foundation for destination management without building the full UI yet.

This pass should stay focused on destination registry storage and safety
validation APIs. Do not widen into the destination-management frontend, naming
cleanup, or broader verification modes.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `agent-ledger/CURRENT_STATE.md`
2. `WORKSPACE_CONTEXT.md`
3. `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`
4. `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`
5. `README.md`
6. `engine/db.py`
7. `webapp/models.py`
8. `webapp/app.py`
9. `tests/test_engine_db.py`
10. `tests/test_webapp.py`

Then read only the files directly needed for your implementation.

## Problem statement

Hardlink Organizer currently gets destination roots only from config under
`dest_sets`. That works, but it leaves the planned `0.4.x` destination
management workflow backend-empty:

- there is no persisted destination registry in the app database
- there is no API for listing or mutating managed destinations
- there is no validation endpoint to check whether a candidate destination path
  is safe enough to save

The broader roadmap already calls for UI-managed destination roots with strong
guardrails, but the backend foundation is still missing.

## Required outcome

Implement a bounded backend slice that adds destination registry persistence and
basic safety validation endpoints so the later UI pass has a stable API to call.

## Scope

Do:

- add database support for a destination registry
- add database support for allowed browse roots if needed by your design, but
  keep it minimal
- add backend models and API routes for destination registry CRUD
- add a validation endpoint for candidate destination paths
- keep all validation preview-first and non-destructive
- add or update focused tests
- update README API notes if the new backend routes materially change the
  documented surface

Do not:

- build the `Destinations` tab or add modal UI
- implement filesystem browsing UI
- add naming cleanup or rename rules
- replace config-driven `dest_sets` for existing link execution
- widen into arbitrary source or destination verification modes
- redesign unrelated web app flows

## Minimum expected implementation

### Database

Add the minimum schema needed for a destination registry. Prefer fields close to
the roadmap:

- `id`
- `label`
- `path`
- `tag`
- `enabled`
- `notes`
- `created_at`
- `updated_at`

If you add `allowed_browse_roots`, keep it narrow and justified by the backend
validation logic. Do not overbuild import or export behavior.

### API

At minimum, implement:

- `GET /api/destinations`
- `POST /api/destinations`
- `PATCH /api/destinations/{id}`
- `DELETE /api/destinations/{id}`
- `POST /api/destinations/validate`

You do not need to implement `GET /api/fs/browse` in this slice unless it turns
out to be necessary for a clean validation contract. Prefer leaving browse work
for a later prompt.

### Validation behavior

Validation should stay conservative and should return structured results rather
than only a yes or no flag.

At minimum, check:

- path exists
- path is a directory
- path is not obviously unsafe such as:
  - `/`
  - `/config`
  - `/data`
  - app internal directories
  - other obvious system roots you can defend clearly
- whether the path is writable, or explain if not

If you can do so cleanly, also surface:

- whether the path falls under an allowlisted root
- whether the path appears link-compatible with existing configured source roots
- whether the path layout looks risky on Unraid, using the same warning posture
  already established for preview

Do not block on perfect cross-filesystem certainty. Clear warnings are better
than fake precision.

### Compatibility rule

This slice must not break the current config-driven link workflow. Managed
destinations can exist alongside configured `dest_sets` for now.

## Design guidance

- preserve the current preview-first, safety-first posture
- prefer thin web routes over route-local business logic
- keep schemas easy to extend later for the destination-management UI
- do not silently accept unsafe or ambiguous paths
- return structured validation output that a later UI can render without
  reverse-engineering strings
- favor narrow, defensible implementation over ambitious completeness

## Suggested implementation areas

- `engine/db.py`
- `webapp/models.py`
- `webapp/app.py`
- `tests/test_engine_db.py`
- `tests/test_webapp.py`
- `README.md` only if API docs need it

If a small helper module is clearly cleaner, add one, but keep the slice tight.

## Validation

Run the most relevant local tests you can.

At minimum, attempt:

- `python3 -m unittest tests/test_engine_db.py -v`
- `python3 -m unittest tests/test_webapp.py -v`

If you run the full suite instead, say so.

If local dependency issues force a narrower validation path, state that clearly.

## Final response requirements

- list changed files
- summarize the destination registry and validation backend added
- state which API routes were introduced or changed
- summarize the validation rules and any warnings surfaced
- state what tests you ran
- call out the remaining gap before the later destination-management UI slice
