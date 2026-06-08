# Prompt 80: Maintenance Batch — F2 + F6 + F8 + F9

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off (no operator questions — all changes are mechanical)

---

## Context

This loop closes four findings from the Gemini pre-release audit
(`docs/gemini-pre-release-audit.md`), fact-checked and confirmed by the
prime agent. All prior loops are complete; 198 tests pass on `main`.

No operator questions needed. Implement all four, verify tests pass, write
the closure report, print the copy-paste excerpt.

**This prompt can run concurrently with prompt-79** — the file sets do not
overlap at all.

---

## Repository root

`/Users/dante/Citadel/HardlinkOrganizer`

---

## F2 — Missing secondary indexes in SQLite schema

### Location
`engine/db.py:22` (`_SCHEMA` string)

### What goes wrong
The schema creates six tables with only `INTEGER PRIMARY KEY AUTOINCREMENT`
indexes. No secondary indexes exist. These queries run on every inventory
load and every history check and will full-scan as the DB grows:

- `SELECT id FROM scans WHERE source_set = ? ORDER BY id DESC LIMIT 1`
  — needs index on `scans(source_set)`
- `SELECT * FROM inventory WHERE scan_id = ?`
  — needs index on `inventory(scan_id)`
- `SELECT * FROM link_history WHERE source_set = ?` (if that query exists)
  — check queries in `db.py`; add index on `link_history(source_set)` if used

### Fix
Add `CREATE INDEX IF NOT EXISTS` statements at the end of the `_SCHEMA`
string, after all `CREATE TABLE` blocks:

```sql
CREATE INDEX IF NOT EXISTS idx_scans_source_set
    ON scans (source_set);

CREATE INDEX IF NOT EXISTS idx_inventory_scan_id
    ON inventory (scan_id);

CREATE INDEX IF NOT EXISTS idx_link_history_source_set
    ON link_history (source_set);

CREATE INDEX IF NOT EXISTS idx_verification_results_run_id
    ON verification_results (run_id);
```

Verify which `link_history` queries actually filter by `source_set` before
adding that index — only add it if queries exist that would use it.

`CREATE INDEX IF NOT EXISTS` is safe to add to an existing schema — it is
idempotent and will be applied to databases already in use when `_init_schema`
runs on next startup.

---

## F6 — README stale version and missing no-auth warning

### Location
`README.md`

### Two issues

**F6a — Version table is stale**

The "At A Glance" table in `README.md` still reads:

```markdown
| Version | `0.3.0` |
```

Update to:

```markdown
| Version | `1.0.0-rc.1` |
```

Also update the Status row if it still says `verification foundation` — it
should reflect the current pre-release state.

**F6b — No warning about network exposure**

The app has no authentication layer. There is no note in the README warning
operators not to expose port 7700 to the public internet. Add a concise
security note in a visible location (near the Quick Start or At A Glance
sections). Example:

```markdown
> **Security note:** Hardlink Organizer has no authentication. It is designed
> for trusted local or LAN use only. Do not expose port 7700 to the public
> internet or untrusted networks.
```

---

## F8 — Startup banner uses print() instead of logger

### Location
`webapp/run.py:70–77`

### What goes wrong
The startup banner and config summary are written with `print()`:

```python
print(f"\n  ╔══════════════════════════════════════════╗")
print(f"  ║   Hardlink Organizer v{_ver}        ║")
print(f"  ╚══════════════════════════════════════════╝")
print(f"\n  → UI:      http://{args.host}:{args.port}")
print(f"  → API:     http://{args.host}:{args.port}/api/docs")
print(f"  → Config:  {args.config}")
print(f"  → DB:      {db_path}\n")
```

`setup_logging` is called before this block. If a `log_file` is configured,
these startup details go to stdout only — not the log file. For headless
deployments (Docker, NAS service), the log file is the primary diagnostic
surface.

### Fix
Get a logger in `webapp/run.py` and replace the print calls with
`logger.info()`. The box-drawing banner can stay as-is in logger output —
loggers don't strip unicode. Read the top of `run.py` to see how
`setup_logging` is imported and called to understand the right logger name
to use.

```python
import logging
_logger = logging.getLogger("hardlink_organizer")

# replace each print(...) with _logger.info(...)
```

The `print(f"ERROR: ...")` calls for configuration errors should stay as
`print(..., file=sys.stderr)` — those are pre-logging startup failures and
need to reach stderr even if the logger isn't configured.

---

## F9 — Loose dependency version pins

### Location
`requirements.txt`

### What goes wrong
All dependencies use `>=` minimum bounds:

```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
httpx>=0.27.0
pytest>=8.0.0
```

For a stable v1 Docker image, a `requirements.txt` with `>=` allows any
future minor version to be pulled in at build time. A breaking change in
FastAPI or uvicorn would silently fail the next container build.

### Fix
Before pinning, run:

```bash
pip freeze | grep -E "fastapi|uvicorn|httpx|pytest|pydantic|anyio|starlette"
```

Use the currently installed exact versions to pin. Apply `==` pins only to
the direct dependencies listed in `requirements.txt` (not transitive deps —
that is what a lockfile is for). The comment about `tomli` and the Python 3.11
note should stay.

Example result:

```
fastapi==0.115.x
uvicorn[standard]==0.29.x
httpx==0.27.x
pytest==8.x.x
```

Note: if pydantic is a transitive dep of FastAPI and already being pulled in,
consider adding it explicitly with a pinned version since FastAPI's behavior
varies significantly between pydantic v1 and v2.

---

## Files to read before starting

1. `engine/db.py:22–100` — full `_SCHEMA` string and all queries to understand which indexes are useful
2. `engine/db.py:273–295` — `get_history` and related queries to confirm `link_history` filter columns
3. `README.md` — full file to find version table and right placement for security note
4. `webapp/run.py` — full file; find setup_logging call and print block
5. `requirements.txt` — full file

---

## Acceptance criteria

- [ ] `_SCHEMA` in `engine/db.py` contains `CREATE INDEX IF NOT EXISTS` for at minimum `scans(source_set)` and `inventory(scan_id)`
- [ ] `README.md` version table shows `1.0.0-rc.1`
- [ ] `README.md` contains a visible no-auth / network exposure warning
- [ ] Startup output in `webapp/run.py` uses `logger.info()` not `print()`
- [ ] Error print calls (`file=sys.stderr`) are preserved unchanged
- [ ] `requirements.txt` uses `==` pins for all direct dependencies
- [ ] All 198 existing tests pass

---

## Closure report

Write to `.raiden/writ/CLOSURE_F2_F6_F8_F9.md`:

```markdown
# Closure Report — F2 + F6 + F8 + F9

**Date:** <date>
**Commit:** <hash>
**Tests:** <N> passed, 0 failed

## F2 — DB indexes
Indexes added: <list them>
Files changed:
- engine/db.py : added CREATE INDEX statements to _SCHEMA

## F6 — README
Files changed:
- README.md : updated version to 1.0.0-rc.1, added no-auth warning

## F8 — print() → logger
Files changed:
- webapp/run.py : startup banner now uses logger.info()

## F9 — Version pins
Pinned versions: <list fastapi==x.y.z etc>
Files changed:
- requirements.txt : pinned all direct deps with ==

## Open follow-ups
<any notes, or "none">
```

---

## Copy-paste excerpt for prime agent

```
**[F2 + F6 + F8 + F9] closed — commit `<hash>`**

| Fix | File | Change |
|---|---|---|
| F2 | engine/db.py | Added indexes: idx_scans_source_set, idx_inventory_scan_id, <others> |
| F6 | README.md | Version updated to 1.0.0-rc.1; no-auth warning added |
| F8 | webapp/run.py | Startup banner uses logger.info() |
| F9 | requirements.txt | All direct deps pinned with == |

Tests: <N> passed, 0 failed.
```
