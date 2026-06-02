# Closure Report — F1 + F3 + F4 + F5

**Date:** 2026-06-02
**Commit:** adf6029
**Tests:** 200 passed, 0 failed

## F4 — Private import
Public name chosen: `classify_mount_layout`
(Operator requested cross-platform readiness; dropping `_path` suffix and the underscore yields a name that scales to Unraid, TrueNAS, Proxmox, OMV, and future platforms.)

Files changed:
- `hardlink_organizer.py` : renamed `_classify_mount_layout_path` → `classify_mount_layout` (function def + 2 internal call sites)
- `engine/__init__.py` : added `classify_mount_layout` to import list and `__all__`
- `webapp/app.py` : updated import from `from hardlink_organizer import _classify_mount_layout_path` to `from engine import classify_mount_layout`; updated call site in `_validate_dest_path`

## F1 — UNSAFE check on CREATE
Files changed:
- `webapp/app.py` : `create_destination` now calls `_validate_dest_path(body.path)` before `d.add_destination`; raises `HTTPException(400)` when `is_unsafe_root=True`. Non-existent but safe paths still succeed (only `is_unsafe_root` is a hard block).

New tests added to `TestDestinationAPI`:
- `test_create_destination_unsafe_root_returns_400` — verifies `/boot` is rejected with 400
- `test_create_destination_nonexistent_safe_path_succeeds` — verifies non-existent safe path still creates (status 201)

## F3 — Error shapes
Decision: **fix now**

Changed:
- `webapp/app.py` : added `RequestValidationError` import from `fastapi.exceptions`
- `webapp/app.py` : added `@app.exception_handler(HTTPException)` normalizing to `{"errors": [...]}`
- `webapp/app.py` : added `@app.exception_handler(RequestValidationError)` normalizing to `{"errors": [...]}` with `loc -> msg` formatting

All error responses across the API now use the `{"errors": ["..."]}` shape consistently.

## F5 — Test disk state
Files changed:
- `tests/test_webapp.py` : added `import os` to module imports
- `tests/test_webapp.py` : `test_execute_real_creates_hardlink` now asserts:
  - `os.path.exists(dst_path)` — destination file was created
  - `os.stat(full_path).st_ino == os.stat(dst_path).st_ino` — same inode (real hardlink, not a copy)
  - `os.stat(dst_path).st_nlink >= 2` — link count confirms hardlink

## Open follow-ups
None. C-2/R-1/R-2/R-3 remain open per prior tracking.
