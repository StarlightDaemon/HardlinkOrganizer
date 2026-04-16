# Verification UI Validation Note

Date: `2026-04-16`

## Scope

This note records the actual validation outcome for the history-driven
verification UI slice (`prompt-32`) and the debugging work required to make the
test evidence trustworthy.

## What happened

- The verification UI implementation landed in the frontend and backend.
- Early closure attempts incorrectly attributed hanging tests to verification
  route code.
- Reproduction later showed the hang was broader than `POST /api/verify`.

## Confirmed root cause

The current local dependency stack hangs when using FastAPI's `TestClient`, even
for a minimal one-route FastAPI app.

Observed local versions during debugging:

- `fastapi 0.135.3`
- `starlette 1.0.0`
- `httpx 0.28.1`
- `anyio 4.13.0`

This matters because the original web API tests used `TestClient`, so they were
not a reliable signal for whether Hardlink Organizer itself was broken.

## Important negative findings

These theories were investigated and ruled out:

- inline imports inside verification routes were not the real cause
- `POST /api/verify` was not uniquely broken
- the verification engine did not hang when called directly
- the SQLite verification write path completed normally outside `TestClient`

Direct verification engine execution succeeded with the same temporary source,
destination, and database setup used by the web tests.

## Actual fix

The web test harness in `tests/test_webapp.py` was rewritten to avoid
`TestClient`.

Instead, the suite now:

- resolves FastAPI routes directly from the app router
- constructs a small request scope per test call
- invokes async and sync endpoints directly
- converts `HTTPException`, `Response`, and Pydantic model results into a small
  response object used by the tests

This preserves validation of route behavior, path parameter handling, body
model construction, query parameter conversion, response payloads, and status
codes without depending on the broken `TestClient` path in this environment.

## Why this is acceptable

For this workspace, the key requirement was to validate Hardlink Organizer's
web API and verification UI backend behavior. The replacement harness does that
reliably with the installed dependency set.

It does not claim to validate the full external ASGI client stack.

## Validation results

The following commands passed after the harness change:

```bash
.venv/bin/python -m unittest tests.test_webapp -v
.venv/bin/python -m unittest discover -s ./tests -v
```

Observed result for the full suite:

- `Ran 145 tests in 7.200s`
- `OK`

## Review guidance

When reviewing this slice later:

1. Treat the verification UI feature work as implemented and locally validated.
2. Treat the previous "async import deadlock" theory as superseded.
3. Treat `tests/test_webapp.py` as intentionally using a local route harness,
   not as an accidental divergence.

## Remaining caveat

If future work needs true HTTP-level integration coverage again, add a separate
follow-up to:

- pin or adjust the FastAPI/Starlette/httpx/anyio test stack to a compatible set
- or replace the local harness with a verified client strategy once the hang is
  understood upstream
