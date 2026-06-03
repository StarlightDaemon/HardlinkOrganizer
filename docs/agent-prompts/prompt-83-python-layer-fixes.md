# Prompt 83 — Python Layer Fixes (3 surgical changes)

**Target model:** Claude Sonnet 4.6
**Effort:** Small — three targeted edits across two files
**Run order:** Run this before Prompt 85 (peer-scan tests). Can run in parallel with Prompt 84.

---

## Context

HardlinkOrganizer is a Python/FastAPI tool at `/mnt/e/HardlinkOrganizer`.
These three fixes come from a verified post-release audit. All changes are
in `hardlink_organizer.py` and `webapp/app.py` only.

---

## Fix 1 — Add `inode` to `InventoryEntry` TypedDict

**File:** `hardlink_organizer.py:49–59`

`InventoryEntry` is a `TypedDict` declared at line 49. `scan_source_set`
injects `"inode": inode` into each entry at line 346, but `inode` is not
declared in the TypedDict. Strict type-checking (`mypy --strict`) raises a
`TypedDict` key error on every access.

**Change:** Add `inode: int | None` as the last field in `InventoryEntry`,
after `device_id: int`. No other changes.

---

## Fix 2 — Validate `full_path` is within source-set root

**File:** `webapp/app.py`, inside `get_inventory_detail` (route starts at line 411)

The route accepts `full_path: str` as a query parameter and immediately does
`src = Path(full_path)` at line 441 followed by `src.stat()`. There is no
check that `full_path` falls within the source set root that was supplied.
A caller can stat any path on the filesystem.

**Change:** After the `source_set not in c["source_sets"]` guard (line 415–419),
add a bounds check immediately before the stat block:

```python
source_set_root = Path(c["source_sets"][source_set]).resolve()
try:
    if not Path(full_path).resolve().is_relative_to(source_set_root):
        raise HTTPException(
            status_code=400,
            detail="full_path is outside the requested source set root.",
        )
except (OSError, ValueError):
    raise HTTPException(
        status_code=400,
        detail="full_path is outside the requested source set root.",
    )
```

Use `Path.is_relative_to()` (Python 3.9+). The project already uses union
type syntax (`str | None`) which requires 3.10+, so 3.9+ methods are safe.

---

## Fix 3 — Wrap blocking filesystem scan in `run_in_threadpool`

**File:** `webapp/app.py`

`get_inventory_detail` is declared `async def` (line 411). At line 504 it
calls `_find_dest_inode_peers(...)` synchronously. That function does a
full two-level `os.scandir` + `os.stat` walk over every configured dest set.
Blocking I/O in an `async def` FastAPI route stalls the uvicorn event loop
for all concurrent requests until the walk completes.

**Change — import:** Add the following import near the top of `webapp/app.py`
alongside the other `starlette` imports (around line 22–23):

```python
from starlette.concurrency import run_in_threadpool
```

**Change — call site:** Replace the synchronous call at line 504:

```python
dest_peers = _find_dest_inode_peers(c, inode, device_id_val, full_path)
```

with:

```python
dest_peers = await run_in_threadpool(
    _find_dest_inode_peers, c, inode, device_id_val, full_path
)
```

No changes to `_find_dest_inode_peers` itself — it remains a plain synchronous
function, which is correct since `run_in_threadpool` runs it in a thread pool
executor.

---

## Verification

```bash
cd /mnt/e/HardlinkOrganizer && python -m unittest discover -s ./tests -v 2>&1 | tail -20
```

All existing tests must pass. Report what passed, what failed, and what you changed.

---

## Constraints

- Do not change `engine/db.py`, any test files, or any frontend files.
- Do not add error handling beyond what is specified above.
- Do not refactor surrounding code — these are surgical insertions only.
- The one-line `_find_dest_inode_peers(...)` call becomes a two-line `await
  run_in_threadpool(...)` call. No other changes to the `get_inventory_detail`
  function body.
