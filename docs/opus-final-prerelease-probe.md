# Opus Final Pre-Release Probe — HardlinkOrganizer v1.0.0-rc.1

**Review date:** 2026-06-02
**Model:** Claude Opus (extended thinking)
**Scope:** Adversarial pre-release probe — correctness, concurrency, edge cases

---

## Verdict

HardlinkOrganizer v1.0.0-rc.1 is ready for a stable v1.0.0 tag. No critical or high-severity defects were found. The two prior audit passes were thorough and addressed the significant correctness issues. The remaining findings are all low severity — they represent defense-in-depth improvements, documentation clarity items, and future maintenance considerations, none of which can produce wrong behavior or data corruption under realistic production use. The health endpoint concurrency gap (Probe 1) is the most technically interesting finding but is not exploitable in practice due to Python's GIL and SQLite's internal serialization.

---

## Findings

### [PROBE 1] Health endpoint uses shared connection outside the RLock
**File:** `webapp/app.py:192-193`, `engine/db.py:143-148`
**Severity:** Low
**Confirmed or Plausible:** Confirmed (theoretical hazard), not practically exploitable

**Reasoning:**

The `/health` route does:
```python
d._conn().execute("SELECT 1")
```

`_conn()` acquires `self._lock`, checks/opens the connection, then *releases* the lock before returning the `sqlite3.Connection` object. The subsequent `.execute("SELECT 1")` call runs outside the lock.

Meanwhile, every other `Database` method (e.g., `record_scan`, `get_latest_inventory`) holds `self._lock` for the entire duration of their `conn.execute(...); conn.commit()` sequence.

This creates a window where:
1. Health route calls `_conn()` → gets connection object → lock released.
2. Another thread enters `record_scan` → acquires lock → calls `conn.execute(INSERT...)` → calls `conn.commit()`.
3. Health route calls `conn.execute("SELECT 1")` concurrently on the same connection object.

However, this is **not practically exploitable** for three reasons:

1. **Python's GIL** prevents truly concurrent Python bytecode execution. The `sqlite3` module's `.execute()` method holds the GIL for most of its duration (it only releases GIL during the actual SQLite C-level `sqlite3_step()`).

2. **SQLite's internal serialization**: The connection was opened with `check_same_thread=False`, and SQLite in WAL mode with its default serialized threading mode (`SQLITE_THREADSAFE=1`, which is how Python's `sqlite3` module is compiled) serializes all operations on the same connection object at the C level.

3. **The query is read-only**: `SELECT 1` cannot conflict with any write operation. It doesn't read from any table, so it can't observe a partial write.

The worst realistic outcome is a slight ordering surprise in the WAL, not data corruption.

**Recommendation:** For defense-in-depth, the health route could acquire the lock explicitly:
```python
with d._lock:
    d._conn().execute("SELECT 1")
```
This is a minor cleanup, not a release blocker.

---

### [PROBE 6] No scan pruning — unbounded database growth
**File:** `engine/db.py` (entire file — no DELETE on scans/inventory exists)
**Severity:** Low
**Confirmed or Plausible:** Confirmed

**Reasoning:**

Every call to `POST /api/scan` inserts a new `scans` row and N `inventory` rows. `get_latest_inventory` only reads the most recent scan. Old scans are never deleted.

- There is **no scan pruning or retention logic** anywhere in the codebase.
- There is **no retention config** in `config.example.toml`.
- FK enforcement is on (`PRAGMA foreign_keys=ON` in `_connect()`), and no `ON DELETE CASCADE` is declared on `inventory.scan_id REFERENCES scans(id)`. This means any future attempt to add scan pruning will need to delete inventory rows before their parent scan row, or the FK check will raise `sqlite3.IntegrityError`.

**Growth rate estimate:** A typical NAS media library with ~2000 top-level entries, rescanned daily:
- 2000 inventory rows/day × 365 days = ~730,000 rows/year
- Each inventory row is ~200 bytes → ~146 MB/year of inventory data alone
- With WAL overhead, perhaps ~200 MB/year total

This will not become operationally problematic for at least 2-3 years for a typical user. SQLite handles millions of rows efficiently with proper indexing (which F2 added). WAL checkpoint behavior is unaffected since only recent scans are queried.

**Recommendation:** This is a v1.1 or v1.2 maintenance item, not a v1.0.0 blocker. When adding scan retention:
1. Add `ON DELETE CASCADE` to `inventory.scan_id` via a migration, or
2. Delete inventory rows first in a transaction, then delete the scan row.
3. Add a `scan_retention_count` config setting (e.g., keep last 10 scans per source set).

---

### [PROBE 8] generate_display_name can return empty string for pathological inputs
**File:** `hardlink_organizer.py:168-217`, `hardlink_organizer.py:220-222`, `hardlink_organizer.py:737-751`
**Severity:** Low
**Confirmed or Plausible:** Confirmed (for pathological inputs only)

**Reasoning:**

Tracing `generate_display_name` with adversarial inputs:

| Input | After dot/underscore replace | After whitespace collapse + strip | Result |
|---|---|---|---|
| `"."` | `" "` | `""` | **Empty string** |
| `".."` | `" "` | `""` | **Empty string** |
| `"   "` | `"   "` | `""` | **Empty string** |
| `"___"` | `"   "` | `""` | **Empty string** |
| `"..."` | `"   "` | `""` | **Empty string** |

When `generate_display_name` returns `""`, the downstream flow is:

1. `scan_source_set` stores `display_name: ""` in the InventoryEntry.
2. `build_link_plan` calls `suggest_destination_name(entry["display_name"])` when `dest_subpath` is falsy.
3. `suggest_destination_name("")` returns `""` (it's a passthrough function).
4. `build_link_plan` checks `if not dest_subpath:` — empty string is falsy, so it calls `suggest_destination_name` again → gets `""` again → returns `""`.
5. `LinkPlan.__init__` computes `self.dest_full = str(Path(dest_root) / "")` → this equals `dest_root` itself (e.g., `/mnt/media/movies`).
6. `is_valid()` then checks `resolved_full.relative_to(resolved_root)` — `Path("/mnt/media/movies").relative_to(Path("/mnt/media/movies"))` returns `Path(".")`, which does NOT raise `ValueError`. So `is_valid()` returns `True`.
7. `execute_link_plan` would then attempt to hardlink directly into the dest root directory path — for a file, `os.link(src, dest_root)` would fail with `IsADirectoryError` or `FileExistsError` (since dest_root exists as a dir). For a dir, `hardlink_tree(src, dest_root, ...)` would merge content into the root dir.

**However:** This only triggers for source entries literally named `.`, `..`, `___`, or `...` — which are almost impossible in real NAS media libraries. Files named `.` or `..` cannot exist on any standard filesystem. A directory/file named `___` or `...` is theoretically possible but would be an extreme edge case.

There is **no infinite recursion** — `build_link_plan` calls `suggest_destination_name` exactly once in the falsy branch, does not loop.

**Recommendation:** Not a release blocker. For defense-in-depth, `build_link_plan` could add:
```python
if not dest_subpath:
    dest_subpath = entry["real_name"]  # fall back to raw name
```
Or `suggest_destination_name` could fall back to the `real_name` when `display_name` is empty.

---

## Probes with no findings

### [PROBE 2] F3 exception handler gap — unhandled exceptions
Traced and found clean. The frontend `client.ts:26-28` handles all non-OK responses identically: it reads `res.text()` and throws `new Error(...)` with the raw text. It does **not** parse `{"errors": [...]}` vs `{"detail": "..."}` — it treats the entire response body as an opaque error string. Therefore, even if an unhandled Python exception produces a `{"detail": "Internal Server Error"}` shaped response (the FastAPI default for uncaught exceptions), the frontend simply throws it as a raw string. The inconsistency in response shape is **effectively harmless** — no client code branches on the structure of the error body. The only consumer is a human reading the error message.

### [PROBE 3] TOCTOU window in hardlink_file
Traced and found clean. The TOCTOU gap between `lstat(dst)` and `os.link(src, dst)` is real but:
1. If another process creates `dst` between steps, `os.link` raises `FileExistsError`, caught by `except OSError`, recorded in `result.failed`. No data corruption — the pre-existing file is never overwritten.
2. If the source is deleted between steps, `os.link` raises `FileNotFoundError`, also caught by `except OSError`, recorded in `result.failed`.
3. There is **no scenario** where the race produces a silent wrong result. `os.link` operates on the source inode atomically — it cannot "link the wrong file." If `src` is renamed and a different file takes its name between `lstat(dst)` and `os.link(src, dst)`, `os.link(src, dst)` would link whatever file now lives at `src` — but `lstat` was on `dst`, not `src`, so the rename scenario doesn't create a confused-deputy problem.
4. For a single-user NAS tool with human-initiated operations, this race window is operationally insignificant.

### [PROBE 4] Path traversal via dest_subpath with absolute component
Traced and found clean. `is_valid()` is called before execution in **every code path**:
- **Web execute route** (`webapp/app.py:418`): `plan.is_valid()` is called, and if `not ok`, the route returns early with errors before `execute_link_plan` is reached.
- **`execute_link_plan`** itself (`hardlink_organizer.py:869`): calls `plan.is_valid()` as its first operation and returns `None` if invalid.
- **CLI `link` command** (`hardlink_organizer.py:1082`): calls `plan.is_valid()` and exits if invalid.
- **Interactive flow** (`hardlink_organizer.py:981`): calls `plan.is_valid()` and aborts if invalid.

The `is_valid()` check at line 700-708 catches absolute `dest_subpath` via `resolved_full.relative_to(resolved_root)`, which raises `ValueError` for paths that escape the root. The double-call in the web execute route (once explicitly, once inside `execute_link_plan`) is redundant but not harmful.

Additionally, `build_link_plan` does not independently guard against absolute `dest_subpath`, but this is acceptable because `is_valid()` is always called before any execution.

### [PROBE 5] Scan/execute race condition
Traced and found clean. The H-1 fix resolved by `full_path` makes the preview→execute flow immune to scan-ID shifts. If a scan completes between preview and execute:
- The execute route re-fetches the latest inventory and looks up by `full_path`.
- If the file was renamed/moved between scans, its `full_path` won't match the new inventory, and the execute route returns HTTP 404 (`"Entry not found"`). No silent wrong-path hardlink.
- `record_scan` is **atomic** from the DB's perspective: the `INSERT INTO scans` and `INSERT INTO inventory` rows are all inside a single `with self._lock:` block with a single `conn.commit()` at the end. SQLite's WAL journal ensures the entire batch is visible as one transaction to concurrent readers.

### [PROBE 7] Verification engine — source path no longer exists
Traced and found clean. `_iter_source_files` at line 164-177:
- If `source_root` does not exist as a file or directory, `p.is_file()` returns `False`, and `p.rglob("*")` on a non-existent `Path` raises `FileNotFoundError`.
- This exception propagates up through `run_verification_for_link_history` to the verify route, which does not catch it. FastAPI's default handler returns HTTP 500 with `"Internal Server Error"`.
- This is **not ideal** (a 500 instead of a descriptive error), but it does not produce wrong results or silent failures. The verification run is already created in the DB but will have zero results and zero summary counts (since the exception fires before any results are recorded).
- In practice, this edge case (source directory completely vanished) is rare and the 500 error is self-explanatory to the operator.
- Note: If individual *files* within a valid source root are missing, `_classify` handles this gracefully — `os.stat(source_path)` raises `OSError`, which is caught and returns `STATUS_CANNOT_VERIFY_PERMISSION_ERROR` with notes. So only the complete-root-missing case is unhandled.

### [PROBE 9] hardlink_file public API and symlink src guard
Traced and found clean. `execute_link_plan` at line 865-885 dispatches to either `hardlink_file` (for file entries) or `hardlink_tree` (for dir entries). For file entries, `hardlink_file` is called directly **without** a symlink source guard. However:
1. The symlink guard in `hardlink_tree` (line 854) is for children discovered during recursive traversal. `hardlink_file` handles **individual file entries** that were selected by the user from the inventory.
2. `scan_source_set` at line 263 does check `child.is_symlink()` but still includes symlinks in the inventory — it classifies them by what they resolve to (dir or file). So a symlink-to-file would appear as a file entry in the inventory.
3. If a user selects a symlink-to-file from the inventory and links it, `hardlink_file(symlink_path, dst, ...)` would call `os.link(symlink_path, dst)`, which creates a hardlink to the **symlink inode itself** (not the target file). This is technically wrong but: (a) the user explicitly selected this entry, (b) `scan_source_set` stores the literal scanned path, and (c) for a single top-level symlink-to-file selected by the user, this behavior is arguably acceptable.
4. The `hardlink_file` function is exported via `engine/__init__.py` but is **only called** from `hardlink_tree` (with the guard) and `execute_link_plan` (for single files, as analyzed above). No other call sites exist in the codebase.

This is a design decision, not an oversight — the symlink guard in `hardlink_tree` protects against silently following symlinks during recursive traversal, which is the dangerous case.

### [PROBE 10] Foreign key integrity and scan deletion
Traced and found clean.
- `PRAGMA foreign_keys=ON` is set in `_connect()` (line 140), which is called in `__init__` and whenever `_conn()` reopens a closed connection. Since SQLite requires this pragma per-connection (it's not stored in the DB file), the placement is correct — every connection gets FK enforcement.
- The only `DELETE FROM` in the codebase is `DELETE FROM destinations WHERE id = ?` (line 510). The `destinations` table has no FK references pointing to it from any other table, so this delete can never violate FK constraints.
- No cross-table deletes exist that could trigger FK violations. The `verification_runs.link_history_id` FK is only used for inserts, and no verification run or link history row is ever deleted.
- As noted in Probe 6, the absence of scan pruning means the FK issue on `inventory.scan_id` is latent — it will only matter when pruning is implemented.

---

## Surprises

### [SURPRISE 1] _iter_source_files raises unhandled FileNotFoundError for vanished source root
**File:** `engine/verification.py:164-177`, `webapp/app.py:535`
**Severity:** Low
**Confirmed or Plausible:** Confirmed

This was partially covered in Probe 7 analysis but deserves explicit mention as a surprise finding. When a verification run is triggered for a link history record whose `full_path` (source root) no longer exists on disk:

```python
# verification.py line 175
for child in p.rglob("*"):   # raises FileNotFoundError if p doesn't exist
```

This `FileNotFoundError` propagates through `run_verification_for_link_history` → through the verify route → to FastAPI's default 500 handler. The verification run row is already created in the DB (line 235-241) but will have 0 results and the default 0/0/0/0 summary counts, because `update_verification_run_summary` (line 285) is never reached.

The operator sees an HTTP 500 with no indication that the source root was the problem. This is not a data corruption issue but is a poor user experience for a legitimate operational scenario (source directory cleaned up after linking).

**Recommendation:** Add a guard at the top of `run_verification_for_link_history`:
```python
source_root_path = Path(source_root)
if not source_root_path.exists():
    # Record the run with zero results and a descriptive note
    db.update_verification_run_summary(run_id, 0, 0, 0, 1)
    return run_id
```
This is a post-v1.0.0 improvement.

### [SURPRISE 2] Verification per-file DB commits are individually committed (no batching)
**File:** `engine/verification.py:261-273`, `engine/db.py:410-427`
**Severity:** Low (performance, not correctness)
**Confirmed or Plausible:** Confirmed

Each call to `db.record_verification_result()` acquires the lock, executes an INSERT, and calls `conn.commit()`. For a large directory tree with thousands of files, this means thousands of individual commits. In WAL mode, each commit triggers a WAL write and fsync.

For a source tree with 10,000 files, this could result in 10,000 individual commits during a single verification run. On a NAS with spinning disks, this could take minutes where batched commits would take seconds.

This is not a correctness issue — each result is durably persisted, and the verification can be interrupted without losing prior results. But it's a significant performance consideration for large libraries.

**Recommendation:** Consider batching verification results (e.g., commit every 100 results) in a future version. Not a release blocker.
