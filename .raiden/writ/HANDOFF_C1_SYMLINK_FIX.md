# Handoff — C-1 Symlink Fix (prompt-73)

**Date:** 2026-06-01
**Branch:** `main`
**Commit:** `d205f1e`
**Status:** Complete — all acceptance criteria met, 64/64 tests pass

---

## What was done

Fixed the C-1 critical finding from `docs/v1-release-readiness-report.md`.

Three related bugs in `hardlink_organizer.py` were patched in a single commit:

### Bug 1 — `hardlink_tree` passed symlinks to `os.link()` (was line 844)

`child.is_file()` and `child.is_dir()` both follow symlinks. A symlink-to-file
would pass `is_file()` and reach `os.link(symlink_path, dst)`. On Linux,
`os.link()` hardlinks the symlink inode, not the file data — silently producing
a symlink copy at the destination, not a hardlink. The real file's `nlink` never
increased.

**Fix:** Added `child.is_symlink()` check before `is_dir()`/`is_file()` in the
`hardlink_tree` loop. All symlinks (to files and to dirs) are now skipped and
appended to `result.skipped`. Operator confirmed: skip all symlinks uniformly.

Side effect: this also closes the M-3 circular-symlink infinite-recursion risk
(symlinks-to-dirs are no longer recursed into).

### Bug 2 — `hardlink_file` misidentified a symlink at `dst` as an existing hardlink (was line 789)

`dst.stat()` follows symlinks. If `dst` was a symlink whose target shared the
src inode, `samestat` returned True and the path was silently recorded as
"already linked" in `result.linked` — but no real hardlink existed.

**Fix:** Replaced `dst.exists()` / `dst.stat()` with `os.lstat(dst)`. Symlink
entries at `dst` are now detected via `stat.S_ISLNK`, logged as a warning, and
appended to `result.skipped`.

### Bug 3 — Dangling symlink at `dst` caused an obscure EEXIST crash

`dst.exists()` returns False for a dangling symlink (follows to a missing
target). The code would then call `os.link(src, dst)` which fails with
`FileExistsError` (the symlink directory entry exists). This landed in
`result.failed` with no indication a symlink was the cause.

**Fix:** Covered by the same `os.lstat()` change — a dangling symlink is
detected and skipped cleanly before `os.link()` is ever called.

---

## Files changed

| File | Change |
|---|---|
| `hardlink_organizer.py:782–809` | `hardlink_file` — lstat-based dst detection |
| `hardlink_organizer.py:851–854` | `hardlink_tree` — symlink skip before is_dir/is_file |
| `tests/test_hardlink_organizer.py` | 5 new tests (see below) |
| `docs/v1-release-readiness-report.md` | Added (full v1.0.0 readiness review) |

### New tests (all passing)

- `TestHardlinkFile::test_symlink_at_dst_is_skipped_not_treated_as_hardlink`
- `TestHardlinkFile::test_dangling_symlink_at_dst_is_skipped_not_crashed`
- `TestHardlinkTree::test_symlink_to_file_in_source_is_skipped`
- `TestHardlinkTree::test_symlink_to_dir_in_source_is_skipped`
- `TestHardlinkTree::test_symlink_in_source_skipped_in_dry_run`

---

## Remaining v1.0.0 gates

From `docs/v1-release-readiness-report.md`:

| ID | Severity | Description | File |
|---|---|---|---|
| C-2 | Critical | Default `db_path` falls back to `/tmp` — ephemeral in Docker | `webapp/run.py:62` |
| R-1 | Release blocker | `__version__ = "0.3.0"` — stale | `hardlink_organizer.py:31` |
| R-2 | Release blocker | `docker-compose.yml` references image tag `0.3.0` | `packaging/docker/docker-compose.yml:12` |
| R-3 | Release blocker | TrueNAS catalog declares `1.0.0` while artifact is RC | `packaging/truenas/catalog/app.yaml:3` |
| H-1 | High | Inventory IDs are positional, not stable primary keys | `engine/db.py:212` |
| H-2 | High | Empty `dest_subpath` silently falls back to generated name | `webapp/app.py:395` |

**Minimum gate for stable `v1.0.0` tag:** C-2, R-1, R-2, R-3 must be resolved.
C-1 is now done. C-2 is the next critical to address.

---

## Operator decisions made this session

- Symlinks in source → added to `result.skipped` (visible in execute response)
- Symlinks-to-dirs → skipped uniformly (not recursed), same as symlinks-to-files
- Guard lives in `hardlink_tree` only — `hardlink_file` is not independently guarded for symlink src
- Tests added in same commit
