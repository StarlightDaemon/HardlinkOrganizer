# Closure Report — F2 + F6 + F8 + F9

**Date:** 2026-06-02
**Commit:** 5c6107a
**Tests:** 198 passed, 0 failed

## F2 — DB indexes
Indexes added:
- `idx_scans_source_set` ON scans(source_set)
- `idx_inventory_scan_id` ON inventory(scan_id)
- `idx_link_history_source_set` ON link_history(source_set)
- `idx_verification_results_run_id` ON verification_results(run_id)

All four were confirmed used by queries in db.py before adding. All use
`CREATE INDEX IF NOT EXISTS` — safe to apply to existing databases on next
startup.

Files changed:
- engine/db.py : added CREATE INDEX statements to _SCHEMA

## F6 — README
Changes:
- Version row updated from `0.3.0` to `1.0.0-rc.1`
- Status row updated from `verification foundation` to `pre-release / release candidate`
- Security note added immediately before the Quick Start section warning
  operators not to expose port 7700 to untrusted networks

Files changed:
- README.md : updated version to 1.0.0-rc.1, added no-auth warning

## F8 — print() → logger
- Added `import logging` and module-level `_logger = logging.getLogger("hardlink_organizer")`
- Replaced all 7 startup banner `print()` calls with `_logger.info()`
- Pre-logging error prints (`file=sys.stderr`) preserved unchanged

Files changed:
- webapp/run.py : startup banner now uses logger.info()

## F9 — Version pins
Pinned versions:
- fastapi==0.136.1
- uvicorn[standard]==0.46.0
- httpx==0.28.1
- pytest==9.0.3

Files changed:
- requirements.txt : pinned all direct deps with ==

## Open follow-ups
None.
