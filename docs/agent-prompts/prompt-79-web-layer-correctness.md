# Prompt 79: Web Layer Correctness — F1 + F3 + F4 + F5

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning on

---

## Context

This loop closes four findings from the Gemini pre-release audit
(`docs/gemini-pre-release-audit.md`), fact-checked and confirmed by the
prime agent. All prior loops (C-1 through L-4) are complete; 198 tests pass on `main`.

Your job:
1. Ask the operator the questions below using the `AskUserQuestion` tool
2. Implement all four fixes in one commit
3. Write a closure report to `.raiden/writ/CLOSURE_F1_F3_F4_F5.md`
4. Print the copy-paste excerpt block for the prime agent

---

## Repository root

`E:\Citadel/HardlinkOrganizer`

---

## F4 — Private symbol imported across module boundary

### Location
`webapp/app.py:38` · `hardlink_organizer.py:521` · `engine/__init__.py`

### What goes wrong
```python
# webapp/app.py:38 — current
from hardlink_organizer import _classify_mount_layout_path
```

`_classify_mount_layout_path` has a leading underscore — it is a private
symbol. Importing it directly from the monolith bypasses the public API
surface defined in `engine/__init__.py`. Any refactor of the internal module
can silently break this import.

### Fix
Three-step rename-and-export:
1. Remove the leading underscore from the function name in `hardlink_organizer.py:521`
2. Add the renamed function to the imports and `__all__` list in `engine/__init__.py`
3. Update `webapp/app.py:38` to import via `from engine import <new_name>`

### Operator question (ask before coding)
**Q1 — New public name:** The function classifies a filesystem path as a
known NAS layout type (Unraid user share, MergerFS pool, etc.) and returns
a string key. It is currently named `_classify_mount_layout_path`.
What should the public name be?

Options to present:
- `classify_mount_layout_path` (same name, just remove the underscore)
- `classify_path_context` (shorter, more general)
- Keep name as-is but just export it from `engine/__init__.py` without
  renaming the function (the underscore is a hint, not a true barrier)

---

## F1 — Destination registry CREATE skips the unsafe root check

### Location
`webapp/app.py:643`

### What goes wrong
`POST /api/destinations` saves a new destination path to the registry without
running it through `_validate_dest_path`. The validate endpoint
(`POST /api/destinations/validate`) is advisory-only — operators must call it
manually. The create route bypasses it entirely:

```python
@app.post("/api/destinations", response_model=DestinationEntry, status_code=201)
async def create_destination(request: Request, body: DestinationCreate):
    d: Database = request.app.state.db
    now = ...
    try:
        dest_id = d.add_destination(
            label=body.label,
            path=body.path,          # path never checked against _UNSAFE_DEST_ROOTS
            ...
        )
```

An operator (or a misconfigured client) can add `/boot`, `/etc`, or `/` to
the destination registry with no warning and no error.

### Fix (no operator question needed — fix is clear)
Call `_validate_dest_path(body.path)` inside the create route. If the result
has `is_unsafe_root=True`, raise `HTTPException(400, ...)` before calling
`d.add_destination`. Non-unsafe validation failures (path doesn't exist,
not a directory) should remain warnings, not hard errors on CREATE — the
operator may be adding a destination before the directory exists.

```python
@app.post("/api/destinations", response_model=DestinationEntry, status_code=201)
async def create_destination(request: Request, body: DestinationCreate):
    validation = _validate_dest_path(body.path)
    if validation.checks.is_unsafe_root:
        raise HTTPException(
            status_code=400,
            detail=f"Path {body.path!r} is a system root and cannot be used as a destination.",
        )
    # continue with d.add_destination(...)
```

---

## F3 — Inconsistent error response shapes

### Location
`webapp/app.py` (exception handlers) · `webapp/frontend/src/api/client.ts:27`

### Background
The API exposes two different error shapes:
- `HTTPException` → `{"detail": "..."}` (FastAPI default)
- Pydantic validation errors (422) → `{"detail": [{...}]}`
- App-level validation in responses → `{"errors": ["..."]}`

**Important context:** The frontend API client (`client.ts:27–28`) reads raw
`res.text()` on all non-ok responses and throws a generic `Error` — it does
NOT parse the JSON body. The inconsistency is therefore invisible to the
current frontend. The issue affects:
- Direct API callers using `/api/docs` (Swagger UI)
- Any future script or external integration
- The operator debugging errors in logs

### Operator question (ask before coding)
**Q2 — Error normalization priority:** Given that the current frontend is
unaffected by error shape inconsistency (it throws raw text on any non-ok
response), is it worth adding custom exception handlers now to normalize
`HTTPException` and `RequestValidationError` into a consistent shape? Or
should this be deferred to a future API version when external callers are
anticipated?

If **yes, fix now**: normalize all errors to `{"errors": ["..."]}` to match
the app convention. Add a custom `exception_handler` inside `create_app` for
both `HTTPException` and `RequestValidationError`.

If **defer**: close F3 as a documented non-issue for v1. Add a short comment
in `create_app` noting the inconsistency for future cleanup.

Do not implement F3 unless the operator explicitly says "fix now."

---

## F5 — Execute test doesn't verify disk state

### Location
`tests/test_webapp.py:467`

### What goes wrong
`test_execute_real_creates_hardlink` asserts the API returns `success=True`
and `linked > 0` but never checks the filesystem:

```python
self.assertTrue(data["success"])
self.assertGreater(data["linked"], 0)
self.assertIsNotNone(data["history_id"])
# Missing: assert destination inode == source inode
```

The test would pass even if `os.link` were replaced with `shutil.copy`.

### Fix (no operator question needed)
After the execute call, locate the created destination file and assert:
- the destination path exists
- `os.stat(src_path).st_ino == os.stat(dst_path).st_ino` (same inode = real hardlink)
- `os.stat(dst_path).st_nlink >= 2`

Read the test class setup to find `self.src_root` and `self.dst_root` — use
them to construct the expected destination path from the `linked_files` list
in the response, or from `full_path + dest_subpath`.

---

## Files to read before starting

1. `webapp/app.py:38` — current private import
2. `hardlink_organizer.py:521` — `_classify_mount_layout_path` definition
3. `engine/__init__.py` — current exports list
4. `webapp/app.py:643–660` — `create_destination` route
5. `webapp/app.py:80–144` — `_validate_dest_path` function
6. `webapp/app.py:147–168` — `create_app` factory (where to add exception handlers if F3 is approved)
7. `webapp/frontend/src/api/client.ts:20–32` — how frontend handles errors (confirm F3 context)
8. `tests/test_webapp.py:467–480` — `test_execute_real_creates_hardlink`
9. `tests/test_webapp.py` — read the test class `setUp` to understand `src_root`/`dst_root` paths

---

## Acceptance criteria

- [ ] `_classify_mount_layout_path` is importable via `from engine import <name>` with no leading underscore import
- [ ] `POST /api/destinations` with path `/boot` returns HTTP 400
- [ ] `POST /api/destinations` with a non-existent-but-safe path still succeeds (is_unsafe_root is the only hard block)
- [ ] F3: either normalized exception handlers implemented, or closing comment added per operator decision
- [ ] `test_execute_real_creates_hardlink` asserts matching inodes between source and destination
- [ ] All 198 existing tests pass

---

## Closure report

Write to `.raiden/writ/CLOSURE_F1_F3_F4_F5.md`:

```markdown
# Closure Report — F1 + F3 + F4 + F5

**Date:** <date>
**Commit:** <hash>
**Tests:** <N> passed, 0 failed

## F4 — Private import
Public name chosen: <name>
Files changed:
- hardlink_organizer.py : renamed function
- engine/__init__.py : added to exports
- webapp/app.py : updated import

## F1 — UNSAFE check on CREATE
Files changed:
- webapp/app.py : added is_unsafe_root guard to create_destination

## F3 — Error shapes
Decision: <fix now / deferred>
<if fixed: what was changed>
<if deferred: note added where>

## F5 — Test disk state
Files changed:
- tests/test_webapp.py : added inode assertion to test_execute_real_creates_hardlink

## Open follow-ups
<any notes, or "none">
```

---

## Copy-paste excerpt for prime agent

```
**[F1 + F3 + F4 + F5] closed — commit `<hash>`**

F4 public name: <chosen name>
F3 decision: <fix now / deferred>

| Fix | File | Change |
|---|---|---|
| F4 | hardlink_organizer.py | renamed _classify_mount_layout_path → <name> |
| F4 | engine/__init__.py | added <name> to exports |
| F4 | webapp/app.py | updated import to use engine public API |
| F1 | webapp/app.py | create_destination now rejects unsafe roots with HTTP 400 |
| F3 | <file or "deferred"> | <change or "documented as deferred"> |
| F5 | tests/test_webapp.py | added inode equality assertion to execute test |

Tests: <N> passed, 0 failed.
```
