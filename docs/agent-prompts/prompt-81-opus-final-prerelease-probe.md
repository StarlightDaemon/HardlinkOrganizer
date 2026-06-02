# Prompt 81: Opus Final Pre-Release Probe

**Model:** Claude Opus (latest) with extended thinking enabled
**Mode:** Read-only. No code changes. No commits. Output is a report file only.
**Token budget:** Expendable — use as much thinking as the problem requires.

---

## What this is

A final adversarial pre-release probe of HardlinkOrganizer v1.0.0-rc.1,
preparing for the stable v1.0.0 tag.

Two prior review passes have already run:
1. **Correctness audit (Claude Code)** — 15 findings, all closed
2. **Quality audit (Gemini)** — 9 findings, all closed

This pass should assume those audits were competent but incomplete.
Your job is to find what they missed.

**You are not reviewing for style, architecture opinions, or suggestions —
you are looking for correctness defects, concurrency hazards, silent failure
modes, and edge cases that could produce wrong behavior in production.**

If you find nothing after a thorough adversarial read, say so. Do not pad
the report with observations to fill space. Zero real findings is a valid
and good outcome.

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## What has already been fixed — do not re-report

| ID | Fix |
|---|---|
| C-1 | `hardlink_tree`/`hardlink_file` — symlinks handled via `os.lstat`; symlinks-to-dirs skipped |
| C-2 | Default DB path changed to `/config/hardlink-organizer.db` |
| H-1 | Inventory resolved by `full_path` string, not positional ID |
| H-2 | `ExecuteRequest.dest_subpath` is `str \| None`; fallback is explicit |
| M-1 | `webapp/run.py` reads `HARDLINK_CONFIG` env var |
| M-2 | PATCH destinations uses `model_dump(exclude_unset=True)` |
| R-1–R-3 | Version strings aligned across source, Docker, TrueNAS |
| L-1 | `jinja2` removed from `requirements.txt` |
| L-2 | `/health` returns `db_connected: bool`, not `db_path` |
| L-3 | `/tmp`, `/var/tmp` in `_UNSAFE_DEST_ROOTS` |
| L-4 | `ExecuteResponse` includes `any_linked: bool` |
| F1 | `POST /api/destinations` now rejects unsafe roots with HTTP 400 |
| F2 | `_SCHEMA` has secondary indexes on `scans`, `inventory`, `link_history`, `verification_results` |
| F3 | Custom exception handlers normalize `HTTPException` and `RequestValidationError` to `{"errors": [...]}` |
| F4 | `_classify_mount_layout_path` renamed to `classify_mount_layout`, exported via `engine/__init__.py` |
| F5 | `test_execute_real_creates_hardlink` now asserts matching inodes |
| F6 | README version updated; no-auth warning added |
| F7 | `setStep` guard — deferred (observation only) |
| F8 | Startup banner uses `logger.info()` |
| F9 | `requirements.txt` pinned with `==` |

---

## Probe areas — use extended thinking on each

Work through these in order. For each, reason through the scenario
before concluding. Do not skip to a verdict without tracing the code path.

### Probe 1 — Health endpoint concurrency gap

**Hypothesis:** The `/health` route calls `d._conn().execute("SELECT 1")` without
holding the `Database._lock`. The `_conn()` method acquires the lock to check
or create the connection and then *releases it before returning*. The returned
`sqlite3.Connection` object is then used for `.execute()` outside the lock.
All other `Database` methods hold `self._lock` for the entire duration of
their DB operation.

**Prove or disprove:** Does calling `execute()` on the shared connection
from the health route — without holding the RLock — create a real
thread-safety hazard when another request is simultaneously executing a
`with self._lock: conn.execute(...); conn.commit()` block? Consider:
Python's `sqlite3` module documentation, SQLite WAL mode, and whether
Python's GIL provides any actual protection here.

**Code to read:**
- `engine/db.py:136–150` (`_connect`, `_conn`)
- `webapp/app.py:189–196` (health route)
- Compare against any other `Database` method that accesses `_conn()`

---

### Probe 2 — F3 exception handler gap: unhandled exceptions

**Hypothesis:** The F3 fix normalized `HTTPException` and `RequestValidationError`
to `{"errors": [...]}`. However, FastAPI has a third exception category:
unhandled Python exceptions (any `Exception` that bubbles out of a route handler).
FastAPI's default behavior for these is HTTP 500 with `{"detail": "Internal Server Error"}`.
No custom handler was added for the base `Exception` class.

**Prove or disprove:** After the F3 fix, is it possible for a client to receive
a `{"detail": "..."}` shaped response in any real-world error scenario
(e.g., DB connection failure mid-request, `OSError` from a filesystem call,
an unexpected `KeyError` in config dict access)? If yes, is the inconsistency
operationally meaningful or effectively harmless (e.g., frontend throws raw text
either way)?

**Code to read:**
- `webapp/app.py:170–184` (exception handlers)
- `webapp/frontend/src/api/client.ts:20–32` (how frontend handles errors)
- Any route handler that does unguarded dict access or filesystem I/O

---

### Probe 3 — TOCTOU window in hardlink_file

**Hypothesis:** `hardlink_file` does:
1. `os.lstat(dst)` — check destination state
2. `dst.parent.mkdir(parents=True, exist_ok=True)` — create parent dirs
3. `os.link(src, dst)` — create the hardlink

Between steps 1 and 3, another process could create a file at `dst`. The
lstat at step 1 returns `FileNotFoundError` (dst doesn't exist), but by
step 3 a concurrent writer has created `dst`. `os.link` would then raise
`FileExistsError`, which the `except OSError` block catches and records
in `result.failed`. No data corruption — but the failure message gives no
indication that a race occurred.

Additionally: between step 1 (lstat) and step 3 (os.link), the *source*
file at `src` could be deleted. `os.link` would then raise `FileNotFoundError`.
This also lands in `result.failed`.

**Prove or disprove:**
- Is the failure surface for these TOCTOU scenarios limited to `result.failed`
  with no data corruption risk?
- Is there any scenario where the lstat/link race could produce a silent
  wrong result (e.g., silently linking the wrong file)?
- For a single-user NAS tool, is this race window operationally significant?

**Code to read:**
- `hardlink_organizer.py:782–822` (`hardlink_file`)

---

### Probe 4 — Path traversal via dest_subpath with absolute component

**Hypothesis:** `LinkPlan.__init__` computes:
```python
self.dest_full = str(Path(dest_root) / dest_subpath)
```
In Python, `Path("/safe/root") / "/absolute/escape"` discards `/safe/root`
and returns `Path("/absolute/escape")`. If `dest_subpath` begins with `/`,
`dest_full` silently ignores `dest_root`.

`is_valid()` catches this via:
```python
resolved_full.relative_to(resolved_root)  # raises ValueError if not inside root
```

**Prove or disprove:**
- Is `is_valid()` always called before `execute_link_plan()` in every code
  path (CLI and web)? If there is any path where execution proceeds without
  a prior `is_valid()` call, an absolute `dest_subpath` could escape the
  destination root.
- Does `build_link_plan` itself guard against absolute `dest_subpath`?
- Trace the CLI `link` command path specifically — does it call `is_valid()`?

**Code to read:**
- `hardlink_organizer.py:737–751` (`build_link_plan`)
- `hardlink_organizer.py:675–710` (`LinkPlan.is_valid`)
- CLI `link` command handler (search for `link` subcommand in the argparse
  section near the bottom of `hardlink_organizer.py`)
- `webapp/app.py` execute route

---

### Probe 5 — scan_source_set and the DB write race

**Hypothesis:** The `/api/scan` route calls `scan_source_set` (synchronous,
takes O(N) time for large directories) and then `d.record_scan(...)` to
persist the results. During a slow scan (large directory), the user's
browser inventory table still shows the previous scan. If the user clicks
"Preview" during the scan, the execute route reads `get_latest_inventory`
which returns the *old* scan's entries — that's correct behavior. But if
the scan completes between the user's Preview request and Execute request,
`get_latest_inventory` now returns the *new* scan. Since H-1 was fixed
to use `full_path` as the lookup key, the Execute lookup resolves by path
and is immune to scan-ID shifts.

**Prove or disprove:**
- Is there any remaining race condition in the preview → execute flow that
  H-1's `full_path` fix did not address?
- Specifically: can a file move/rename between Preview and Execute cause
  a silent wrong-path hardlink? (The entry resolves to the right `full_path`
  from the inventory, but the file on disk may have moved.)
- Is the scan itself atomic (all-or-nothing) from the DB's perspective,
  or could a partial scan be visible to concurrent reads?

**Code to read:**
- `engine/db.py:162–193` (`record_scan` — check transaction scope)
- `webapp/app.py:216–254` (`/api/scan` route)
- `webapp/app.py:376–390` (execute entry resolution)

---

### Probe 6 — Database growth and scan retention

**Hypothesis:** `record_scan` inserts a new scan and its inventory entries
every time the operator clicks "Re-scan." Old scan data is never deleted.
`get_latest_inventory` always reads the most recent scan. Over months of
use with daily rescans of a large source set, the `inventory` table could
accumulate hundreds of thousands of rows that are never read again.

The schema now has `idx_inventory_scan_id` (added in F2), so queries
on the current scan are fast. But the DB file grows indefinitely.

**Prove or disprove:**
- Is there any scan pruning or retention logic anywhere in the codebase?
- Is there any configured limit on scan history?
- What is the practical row growth rate for a typical NAS media library
  (estimate: 1000–5000 top-level entries per source set, rescanned daily)?
- At what point would the DB size become operationally problematic (consider
  both disk space and WAL checkpoint behavior)?
- Is this a v1.0.0 concern or a future maintenance item?

**Code to read:**
- `engine/db.py` — all query methods, look for any DELETE on scans/inventory
- `config.example.toml` — any retention config?

---

### Probe 7 — Verification engine completeness

**Hypothesis:** `run_verification_for_link_history` uses `_iter_source_files`
which calls `p.rglob("*")`. The verification engine iterates the source path
from the link history record and checks each file against expected destination
paths. If a source directory was renamed or moved after the link was created,
the source path in the history record no longer exists — `rglob` on a
non-existent path would either return an empty iterator or raise.

**Prove or disprove:**
- How does `_iter_source_files` handle the case where `source_root` does
  not exist? Does it fail silently, raise, or log?
- How does the verification route surface a "source no longer exists"
  scenario to the operator?
- Are verification results for "source missing" distinguishable from
  "hardlink missing at destination" in the response?

**Code to read:**
- `engine/verification.py:164–177` (`_iter_source_files`)
- `engine/verification.py` — `run_verification_for_link_history` in full
- `webapp/app.py:500–520` (verify route)

---

### Probe 8 — generate_display_name and path safety

**Hypothesis:** `generate_display_name` transforms a raw filesystem name
into a cleaned display name. `suggest_destination_name` derives a path
component from the display name. If a source entry has a name that generates
an empty string, a `.`-only string, or a string with embedded path separators
after cleaning, the derived `dest_subpath` could produce unexpected behavior
in `LinkPlan.__init__`.

**Prove or disprove:**
- Can `generate_display_name` return an empty string or a path-unsafe string
  for any input? (Try: entry named `.`, `..`, `   `, all-dots, all-special-chars.)
- If `suggest_destination_name` returns an empty string, what does
  `build_link_plan` do? (`if not dest_subpath:` — it calls
  `suggest_destination_name` again, creating infinite recursion? Or does
  the falsy check stop the loop?)
- Is `suggest_destination_name`'s output ever used as a path component
  without sanitization beyond what `is_valid()` provides?

**Code to read:**
- `hardlink_organizer.py` — `generate_display_name` and `suggest_destination_name`
  definitions (search by name)
- `hardlink_organizer.py:737–751` (`build_link_plan`)

---

### Probe 9 — hardlink_file public API and symlink src guard

**Hypothesis:** The C-1 fix added a symlink guard in `hardlink_tree` before
calling `hardlink_file`. But `hardlink_file` is exported as a public symbol
via `engine/__init__.py`. A caller who invokes `hardlink_file(symlink_path, dst, result)`
directly bypasses the guard and would produce a hardlink to the symlink inode.

**Prove or disprove:**
- Is `hardlink_file` currently called from anywhere in the codebase other
  than `hardlink_tree` and test code?
- In `execute_link_plan`, does the execution path go through `hardlink_tree`
  (which has the guard) or call `hardlink_file` directly?
- Is the absence of a `src.is_symlink()` guard inside `hardlink_file` itself
  a documented design decision or an oversight?

**Code to read:**
- `hardlink_organizer.py` — `execute_link_plan` function (search by name)
- `engine/__init__.py` — confirms `hardlink_file` is in `__all__`
- All call sites: `grep -n "hardlink_file" hardlink_organizer.py`

---

### Probe 10 — Foreign key integrity and scan deletion

**Hypothesis:** `PRAGMA foreign_keys=ON` is set in `_connect()`. The `inventory`
table declares `scan_id INTEGER NOT NULL REFERENCES scans(id)`. If a `scans`
row were deleted, the FK constraint would prevent the delete or cascade,
depending on whether `ON DELETE CASCADE` is declared.

No `ON DELETE CASCADE` is in the schema — so deleting a `scans` row would
raise an FK violation error (since FK enforcement is on). There is no
delete-scan function in the codebase. But this means the DB will grow
indefinitely (see Probe 6), and any future attempt to add scan pruning
would need to handle the inventory rows first.

**Prove or disprove:**
- Is FK enforcement actually being applied? (Check: `PRAGMA foreign_keys=ON`
  must be set per-connection, every time a connection opens — not stored
  in the DB file. Verify this is done correctly in `_connect`.)
- Are there any cross-table deletes in the codebase that could violate FK
  constraints under the current schema?
- Does `delete_destination` (for the registry) have any FK relationships
  that could cascade or block?

**Code to read:**
- `engine/db.py:136–141` (`_connect`)
- `engine/db.py:22–100` (full `_SCHEMA`)
- `engine/db.py:494–502` (`delete_destination`)

---

## Files to read

Read in this order:

1. `hardlink_organizer.py` — full file (1222 lines); focus on `generate_display_name`, `suggest_destination_name`, `build_link_plan`, `execute_link_plan`, `hardlink_file`, `hardlink_tree`, `LinkPlan`
2. `engine/db.py` — full file (500 lines)
3. `webapp/app.py` — full file (707 lines)
4. `engine/verification.py` — full file (293 lines)
5. `webapp/frontend/src/api/client.ts` — error handling only
6. `engine/__init__.py` — exports
7. `config.example.toml`
8. `tests/test_hardlink_organizer.py` — relevant test classes for the probed behaviors
9. `tests/test_engine_db.py` — DB tests

---

## Output format

Save your report to:

```
docs/opus-final-prerelease-probe.md
```

Structure:

```markdown
# Opus Final Pre-Release Probe — HardlinkOrganizer v1.0.0-rc.1

**Review date:** <date>
**Model:** Claude Opus (extended thinking)
**Scope:** Adversarial pre-release probe — correctness, concurrency, edge cases

---

## Verdict

<One paragraph. Is this ready for stable v1.0.0? Name any specific finding
that would block the release. If nothing blocks, say so clearly.>

---

## Findings

For each finding that survives your analysis:

### [PROBE N] Title
**File:** `path/to/file:line`
**Severity:** Critical / High / Medium / Low
**Confirmed or Plausible:** <state your confidence>

<Reasoning — show the code path, the triggering condition, the wrong outcome.>

**Recommendation:** <What should change and why.>

---

## Probes with no findings

For each probe that you analyzed and found clean, include a one-sentence
confirmation that you traced the code and found no defect. Do not omit any
probe from the report.

---

## Surprises

<Any issue you found that was NOT in the probe list above. These are the
most valuable findings — things both prior reviews missed entirely.>
```

---

## Constraints

- **No code changes.** The only file you may write is `docs/opus-final-prerelease-probe.md`.
- **No commits.** Do not run any `git` mutation command.
- **No package installs.**
- Extended thinking is expected and encouraged — use it to reason through
  concurrency scenarios, edge cases, and multi-step code paths before reaching
  a verdict. Don't skip to conclusions.
