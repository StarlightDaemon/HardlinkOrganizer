# Prompt 73: Fix C-1 — Symlink Hardlink Bug

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning on

---

## Context

This is a fix loop for **C-1**, the top-priority finding from the v1.0.0 release readiness review.
The full report is at `docs/v1-release-readiness-report.md`.

The operator is aware of this bug and has read the report. Your job is to review
the fix plan with the operator, confirm the approach and edge-case handling,
then implement and test.

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## The bug

### Location
`hardlink_organizer.py:839–845` (`hardlink_tree`) and `hardlink_organizer.py:787–796` (`hardlink_file`)

### What goes wrong

**Problem 1 — `hardlink_tree` silently passes symlinks-to-files to `hardlink_file`**

```python
# hardlink_organizer.py ~line 839
for child in sorted(children, key=lambda p: (p.is_file(), p.name.lower())):
    rel = child.relative_to(src_dir)
    target = dst_dir / rel
    if child.is_dir():
        hardlink_tree(child, target, result, dry_run=dry_run)
    elif child.is_file():
        hardlink_file(child, target, result, dry_run=dry_run)
    else:
        _logger.debug("SKIP (non-file/dir): %s", child)
```

`child.is_dir()` and `child.is_file()` both follow symlinks. A symlink-to-file
passes `child.is_file()` and is sent to `hardlink_file`. Then:

```python
os.link(src, dst)   # src is the symlink path
```

On Linux, `os.link()` does **not** follow symlinks — it creates a hardlink to the
symlink inode itself, not the file data. The destination is a symlink copy, not a
hardlink. The real file's `st_nlink` never increases. If the source is later
deleted, the destination becomes dangling.

**Problem 2 — `hardlink_file` misidentifies a symlink at `dst` as an existing hardlink**

```python
# hardlink_organizer.py ~line 787
if dst.exists():
    try:
        if os.path.samestat(src.stat(), dst.stat()):
            _logger.debug("SKIP (already linked): %s", dst)
```

`dst.stat()` follows symlinks. If `dst` is a symlink whose target shares an
inode with `src`, `samestat` returns True and the operation is silently recorded
as "already linked" — even though no hardlink was ever created at `dst`.

**Problem 3 — dangling symlink at `dst` causes an obscure EEXIST failure**

`dst.exists()` returns False for a dangling symlink (follows the symlink, finds
no target). The code proceeds to `os.link(src, dst)` which fails with
`FileExistsError` (the symlink directory entry exists). This lands in
`result.failed` with no indication that a symlink was the cause.

---

## Proposed fix (discuss with operator before implementing)

### In `hardlink_tree`

Add an explicit symlink skip **before** the `is_dir()` / `is_file()` checks:

```python
for child in sorted(children, key=lambda p: (p.is_file(), p.name.lower())):
    rel = child.relative_to(src_dir)
    target = dst_dir / rel
    if child.is_symlink():
        _logger.debug("SKIP (symlink): %s", child)
        result.skipped.append(str(child))
        continue
    if child.is_dir():
        hardlink_tree(child, target, result, dry_run=dry_run)
    elif child.is_file():
        hardlink_file(child, target, result, dry_run=dry_run)
    else:
        _logger.debug("SKIP (non-file/dir): %s", child)
```

### In `hardlink_file`

Replace the `dst.exists()` gate with an `os.lstat`-based check that sees the
symlink itself, not its target:

```python
def hardlink_file(src: Path, dst: Path, result: LinkResult, dry_run: bool = False) -> None:
    # Check destination existence without following symlinks
    try:
        dst_lstat = os.lstat(dst)
    except FileNotFoundError:
        dst_lstat = None
    except OSError:
        dst_lstat = None  # treat stat errors as non-existent; os.link will fail and be caught

    if dst_lstat is not None:
        import stat as _stat
        if _stat.S_ISLNK(dst_lstat.st_mode):
            _logger.warning("SKIP (symlink at destination): %s", dst)
        else:
            try:
                if os.path.samestat(src.stat(), os.stat(dst)):
                    _logger.debug("SKIP (already linked): %s", dst)
                else:
                    _logger.warning("SKIP (collision — unrelated file exists): %s", dst)
            except OSError:
                _logger.debug("SKIP (exists, stat failed): %s", dst)
        result.skipped.append(str(dst))
        return

    if dry_run:
        _logger.info("DRY-RUN link: %s -> %s", src, dst)
        result.linked.append(str(dst))
        return

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        os.link(src, dst)
        _logger.info("LINKED: %s -> %s", src, dst)
        result.linked.append(str(dst))
    except OSError as exc:
        _logger.error("FAILED link %s -> %s : %s", src, dst, exc)
        result.failed.append(str(dst))
```

---

## Questions to resolve with the operator before coding

Present these to the operator and confirm answers before writing any code:

1. **Skipped symlinks in `hardlink_tree`**: Should symlinks in the source tree be
   added to `result.skipped` (counted but not linked), or silently ignored (only
   debug-logged)? The proposal above adds them to `skipped`. Does the operator
   want them to appear in the execute response as skipped files?

2. **Symlink-to-dir recursion**: Currently `hardlink_tree` recurses into
   symlinks-to-directories (via `is_dir()` following symlinks). The fix above
   only skips symlinks-to-files. Should the fix also skip symlinks-to-dirs, or
   should they continue to be recursed? Recursing into a symlink-to-dir is not
   wrong per se, but it creates the possibility of circular-symlink loops (a
   separate finding, M-3). Recommend: skip all symlinks uniformly.

3. **`hardlink_file` with a symlink-to-file as `src`**: The fix in `hardlink_tree`
   prevents symlinks from being passed to `hardlink_file`. But `hardlink_file` is
   also a public function callable directly (e.g., from single-file link plans).
   Should `hardlink_file` itself also guard against being called with a symlink
   `src`, or is the guard in `hardlink_tree` sufficient?

4. **Test coverage**: The existing test suite has no tests for symlink inputs.
   Should new tests be added as part of this fix, or deferred? Recommend: add at
   minimum two tests — one for symlink-to-file in source tree, one for symlink at
   destination.

---

## Files to read before starting

1. `hardlink_organizer.py` — read `hardlink_file` (~line 782) and `hardlink_tree`
   (~line 813) in full
2. `tests/test_hardlink_organizer.py` — read `TestHardlinkTree` and
   `TestHardlinkFile` test classes to understand what is already covered
3. `docs/v1-release-readiness-report.md` — read the C-1 section for full context

---

## Acceptance criteria

The fix is complete when:

- [ ] A symlink-to-file in a source directory is skipped (logged, added to
      skipped count), not hardlinked
- [ ] A symlink-to-dir in a source directory is skipped (or recursion is safe
      with cycle detection — confirm with operator)
- [ ] A symlink at the destination is detected via `lstat`, logged as a warning,
      and added to skipped — not silently treated as an existing hardlink
- [ ] A dangling symlink at the destination is handled gracefully (not an obscure
      EEXIST crash)
- [ ] All 180 existing tests continue to pass
- [ ] At least two new tests cover the symlink scenarios
- [ ] `hardlink_tree` dry-run mode handles symlinks consistently with real mode
