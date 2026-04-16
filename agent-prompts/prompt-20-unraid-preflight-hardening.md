# Prompt 20: Unraid Preflight Hardening

Recommended model:
- Claude Sonnet 4.6 (thinking)

Recommended mode:
- planning on

## Goal

Do a bounded implementation pass focused on the most important beta finding from
real Unraid validation: preview can pass while real hardlink execution still fails
with `EXDEV` under certain mount layouts.

Your job is to harden Hardlink Organizer so it better detects, warns about, and
documents unsafe or misleading Unraid mount layouts before users attempt real link
operations.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`
2. `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`
3. `notes/CA_STEP_01_UNRAID_VALIDATION_PLAN.md`
4. `./README.md`
5. `packaging/unraid/README.md`
6. `packaging/unraid/VALIDATION_CHECKLIST.md`
7. `./hardlink_organizer.py`
8. `./engine/`
9. `./webapp/app.py`
10. `./tests/`

## Problem statement

Real Unraid testing found:

- preview passed
- real execution failed with `EXDEV`
- `/mnt/user` and separate bind mounts were misleading
- a shared disk-level parent mount such as `/mnt/disk3:/mnt/disk3` succeeded

The app currently does not explain this clearly enough before execution.

## Required outcome

Implement a first hardening pass that improves safety and operator guidance around
Unraid mount layout.

## Scope

Do:

- identify where preview and execution checks can diverge on Unraid
- add a stronger preflight or warning model for risky mount layouts
- surface mount-layout warnings in backend responses and UI preview where appropriate
- update Unraid deployment docs to recommend shared disk-level parent mounts for
  reliable hardlink execution
- add tests for the new warning or preflight behavior where feasible

Do not:

- implement the full hardlink verification feature
- build destination management UI
- build naming cleanup
- widen into CA submission work

## Minimum expected implementation

### Backend

- add a mount-layout assessment step to the link preflight path
- distinguish:
  - same filesystem appears valid
  - but layout is likely risky on Unraid due to separate mounts or share-style paths
- return warning details in preview or plan responses

### UI

- show a warning banner or warning section in preview when layout is risky
- keep execution possible only if current product behavior requires it, but the
  warning must be explicit and hard to miss

### Documentation

- update operator docs to explain:
  - why `/mnt/user` can be misleading
  - why separate source and destination mounts may still fail
  - why shared disk-level parent mounts are recommended for real hardlink execution

### Tests

- add or update tests for:
  - risky layout warning behavior
  - safe shared-parent layout behavior if practical

## Design guidance

- do not rely on path prefix matching alone as proof
- it is acceptable to produce a warning instead of a hard block in this slice
  if the warning is explicit and the behavior is well tested
- prefer a structured warning model over string-only ad hoc messages
- keep the implementation bounded and pragmatic

## Suggested implementation areas

- link plan or preview result schema
- filesystem validation helper
- web preview endpoint
- preview template or front-end rendering
- Unraid docs and validation checklist

## Validation

Run the most relevant local tests you can.

At minimum, attempt:

- `python3 -m unittest discover -s ./tests -v`

If you cannot run the full suite due to missing dependencies, say so clearly.

## Final response requirements

- list changed files
- summarize the preflight or warning changes
- summarize doc changes
- state what tests or verification you ran
- call out any remaining gaps that still require future work
