# Prompt 77: Fix L-2 + L-4 — Health Endpoint Leak + Success Semantics

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning on

---

## Context

This loop closes two findings from `docs/v1-release-readiness-report.md`:

- **L-2** (Low) — `/health` endpoint exposes the internal database file path unauthenticated
- **L-4** (Low) — `success: true` when all files were skipped and zero were linked

Both need a light operator decision before coding. Ask the questions using the
`AskUserQuestion` tool, implement both fixes, write the closure report, and print
the copy-paste excerpt.

Previous completed loops: C-1, C-2, R-1–R-3, H-1, H-2, M-2, M-1, L-1, L-3.
All tests pass on `main`.

---

## Repository root

`E:\Citadel/HardlinkOrganizer`

---

## L-2 — /health endpoint exposes db._path

### Location

`webapp/app.py:180` · `webapp/models.py:160`

### What goes wrong

```python
@app.get("/health", response_model=HealthResponse)
async def health(request: Request):
    d: Database = request.app.state.db
    return HealthResponse(
        status="ok",
        version=__version__,
        config_loaded=True,
        db_path=str(d._path),      # leaks /config/hardlink-organizer.db
    )
```

Any caller of `/health` — unauthenticated, no session required — receives the
full container-internal filesystem path to the SQLite database. This aids
filesystem layout enumeration for anyone who can reach the port.

The `HealthResponse` model declares `db_path: str | None`, so the field can
be made optional without a schema break.

### Fix options

**Option A — Remove db_path from the response entirely**

```python
return HealthResponse(
    status="ok",
    version=__version__,
    config_loaded=True,
    db_path=None,
)
```

Update `HealthResponse` to either remove `db_path` entirely or make it always
`None`. Clean; no internal state leaks.

**Option B — Return only a boolean `db_connected` flag**

Replace `db_path: str | None` in `HealthResponse` with `db_connected: bool`.
Return `True` if the DB connection is healthy (e.g., run a `SELECT 1`),
`False` otherwise. This is more operationally useful than a path, and leaks
nothing about the filesystem.

```python
class HealthResponse(BaseModel):
    status: str
    version: str
    config_loaded: bool
    db_connected: bool    # replaces db_path

# In route:
try:
    d._conn().execute("SELECT 1")
    db_ok = True
except Exception:
    db_ok = False
return HealthResponse(status="ok", version=__version__, config_loaded=True, db_connected=db_ok)
```

Note: Option B changes the response schema (removes `db_path`, adds
`db_connected`). The frontend's `HealthResponse` TypeScript interface at
`webapp/frontend/src/api/types.ts:201` must be updated to match.

---

## L-4 — success: true when all files were skipped

### Location

`webapp/app.py:443`

### What goes wrong

```python
return ExecuteResponse(
    success=len(result.failed) == 0,
    ...
    linked=len(result.linked),
    skipped=len(result.skipped),
)
```

`success` is `True` as long as `failed` is empty. A run that linked 0 files
(all already existed at the destination, or all were symlinks that were
skipped) returns `success: true, linked: 0`. The UI shows a green success
indicator for an operation that changed nothing. This masks:

- A misconfigured destination path where nothing lands where expected
- A second run on an already-linked tree (fine) versus a first run that
  produced zero links due to a config error (not fine — but indistinguishable)

### Fix options

**Option A — success = false when linked == 0 and not dry_run**

```python
success = len(result.failed) == 0 and (body.dry_run or len(result.linked) > 0)
```

A run that produces zero real links is not a success. Dry runs are excluded
from this check (dry_run with 0 linked is expected and normal).

**Option B — Add a separate `any_linked: bool` field, keep success as-is**

Keep `success = len(result.failed) == 0` unchanged (no errors = success).
Add `any_linked: bool = len(result.linked) > 0` as a separate response field
so the UI can distinguish "succeeded, nothing to do" from "succeeded with
work done". The frontend would need a small update to surface this.

**Option C — Keep current behavior, add a warning in the response**

When `linked == 0 and not dry_run`, include a warning string in `ExecuteResponse.errors`
like `"No files were linked — destination may already be complete."` and keep
`success: true`. Least disruptive.

---

## Questions for the operator

Use the `AskUserQuestion` tool to ask these before writing any code.

### L-2 question

**Q1 — db_path in /health:**
Should `db_path` be removed from the health response entirely (Option A —
return `null`), or replaced with a `db_connected: bool` liveness check that
confirms the database is reachable without exposing its path (Option B)?

### L-4 questions

**Q2 — Success semantics:**
When an execute run produces zero linked files (all skipped, none failed),
should `success` be `false` (Option A — zero links = not a success), or
should the current behavior be kept and a separate `any_linked` field or
warning message added instead (Options B/C)?

**Q3 — Dry run behavior:**
For Option A: should a dry-run that counts 0 linkable files also return
`success: false`? Or should dry runs always return `success: true` (since
they never actually link anything)?

---

## Files to read before starting

1. `webapp/app.py` — read the `/health` route (~line 170–181) and the execute
   response assembly (~line 442–450)
2. `webapp/models.py` — read `HealthResponse` and `ExecuteResponse`
3. `webapp/frontend/src/api/types.ts` — read `HealthResponse` and `ExecuteResponse`
   interfaces (lines ~201–207 and ~74–85)
4. `tests/test_webapp.py` — grep for `test_health` and `test_execute` to understand
   existing coverage

---

## Acceptance criteria

- [ ] `GET /health` no longer returns the internal database file path in any form
- [ ] If Option B chosen: `/health` returns `db_connected: true/false` and
      TypeScript interface is updated to match
- [ ] Execute response `success` field correctly reflects the chosen semantics
- [ ] Dry-run behavior is consistent with the operator's decision on Q3
- [ ] All existing tests pass (update any that assert on `db_path` or `success` value)
- [ ] At least one test covers the all-skipped case for L-4

---

## Closure report

Write a closure report to `.raiden/writ/CLOSURE_L2_L4.md`:

```markdown
# Closure Report — L-2 + L-4

**Date:** <date>
**Commit:** <hash>
**Tests:** <N> passed, 0 failed

## L-2 — /health db_path
Option chosen: <A or B>
Files changed:
- <file> : <what changed>

## L-4 — success semantics
Option chosen: <A, B, or C>
Files changed:
- <file> : <what changed>

## Open follow-ups
<any notes, or "none">
```

---

## Copy-paste excerpt for prime agent

Print this block after writing the closure report:

```
**[L-2 + L-4] closed — commit `<hash>`**

L-2 option chosen: <A (remove db_path) or B (db_connected bool)>
L-4 option chosen: <A (zero links = false) / B (any_linked field) / C (warning)>

| Fix | File | Change |
|---|---|---|
| L-2 | webapp/app.py | <describe> |
| L-2 | webapp/models.py | <describe> |
| L-4 | webapp/app.py | <describe> |

Tests: <N> passed, 0 failed.
```
