# Prompt 72: Fix A2 + D2 — Collision Ambiguity and SQLite 999-Variable Limit

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off

## Goal

Two small targeted fixes in two files. Do them in one pass and commit together.

1. **A2** — `hardlink_file()` silently skips both "already correctly linked"
   and "real collision with unrelated file" the same way. Differentiate them.

2. **D2** — `get_link_status()` builds an unbounded `IN (?, ?, ...)` clause
   that raises `sqlite3.OperationalError` when called with more than 999 paths.
   Chunk the query.

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## Read these files before touching anything

1. `hardlink_organizer.py` lines 748–830 — `LinkResult`, `hardlink_file`, `hardlink_tree`
2. `engine/db.py` lines 311–325 — `get_link_status`
3. `tests/test_hardlink_organizer.py` — find existing `hardlink_file` tests
4. `tests/test_engine_db.py` — find existing `get_link_status` tests

---

## Fix A2 — differentiate already-linked from real collision

**File:** `hardlink_organizer.py`
**Location:** `hardlink_file()`, lines 777–780

**Current code:**
```python
if dst.exists():
    _logger.debug("SKIP (exists): %s", dst)
    result.skipped.append(str(dst))
    return
```

**Replace with:**
```python
if dst.exists():
    try:
        if os.path.samestat(src.stat(), dst.stat()):
            _logger.debug("SKIP (already linked): %s", dst)
        else:
            _logger.warning("SKIP (collision — unrelated file exists): %s", dst)
    except OSError:
        _logger.debug("SKIP (exists, stat failed): %s", dst)
    result.skipped.append(str(dst))
    return
```

`os.samestat` compares `st_ino` and `st_dev` — same inode means already a
hardlink to the same source. `os` is already imported. No callers need changing;
`result.skipped` still accumulates both cases (the distinction is in the log
level: debug vs warning).

**Add a test** in `tests/test_hardlink_organizer.py` alongside existing
`hardlink_file` tests:

```python
def test_hardlink_file_warns_on_collision(tmp_path, caplog):
    import logging
    src = tmp_path / "src.txt"
    src.write_text("original")
    dst = tmp_path / "dst.txt"
    dst.write_text("different content")  # unrelated file

    result = LinkResult()
    with caplog.at_level(logging.WARNING):
        hardlink_file(src, dst, result)

    assert str(dst) in result.skipped
    assert any("collision" in r.message for r in caplog.records)


def test_hardlink_file_silently_skips_already_linked(tmp_path, caplog):
    import logging
    src = tmp_path / "src.txt"
    src.write_text("original")
    dst = tmp_path / "dst.txt"
    os.link(src, dst)  # already a hardlink

    result = LinkResult()
    with caplog.at_level(logging.WARNING):
        hardlink_file(src, dst, result)

    assert str(dst) in result.skipped
    assert not any("collision" in r.message for r in caplog.records)
```

---

## Fix D2 — chunk get_link_status to avoid the 999-variable SQLite limit

**File:** `engine/db.py`
**Location:** `get_link_status()`, lines 311–324

**Current code:**
```python
def get_link_status(self, full_paths: list[str]) -> dict[str, bool]:
    """Batch check: return {full_path: linked} for a list of paths."""
    if not full_paths:
        return {}
    with self._lock:
        placeholders = ",".join("?" * len(full_paths))
        rows = self._conn().execute(
            f"""SELECT DISTINCT full_path FROM link_history
                WHERE full_path IN ({placeholders})
                  AND dry_run = 0 AND linked_count > 0""",
            full_paths,
        ).fetchall()
    linked_set = {r["full_path"] for r in rows}
    return {p: (p in linked_set) for p in full_paths}
```

**Replace with:**
```python
def get_link_status(self, full_paths: list[str]) -> dict[str, bool]:
    """Batch check: return {full_path: linked} for a list of paths."""
    if not full_paths:
        return {}
    linked_set: set[str] = set()
    chunk_size = 900  # stay safely under SQLite's 999-variable limit
    with self._lock:
        for i in range(0, len(full_paths), chunk_size):
            chunk = full_paths[i : i + chunk_size]
            placeholders = ",".join("?" * len(chunk))
            rows = self._conn().execute(
                f"""SELECT DISTINCT full_path FROM link_history
                    WHERE full_path IN ({placeholders})
                      AND dry_run = 0 AND linked_count > 0""",
                chunk,
            ).fetchall()
            linked_set.update(r["full_path"] for r in rows)
    return {p: (p in linked_set) for p in full_paths}
```

**Add a test** in `tests/test_engine_db.py` alongside existing `get_link_status`
tests:

```python
def test_get_link_status_over_999_paths(tmp_db):
    # Insert one real linked path among 1100 paths to verify chunking works.
    real_path = "/mnt/src/show/ep01"
    tmp_db.record_link(
        source_set="src", dest_set="dst",
        full_path=real_path, display_name="ep01",
        dest_path="/mnt/dst/show/ep01",
        entry_type="directory", linked_count=1, skipped_count=0,
        failed_count=0, dry_run=False,
    )
    paths = [f"/mnt/src/show/ep{i:04d}" for i in range(1100)]
    paths[500] = real_path  # inject the real one mid-list

    result = tmp_db.get_link_status(paths)
    assert result[real_path] is True
    assert sum(result.values()) == 1
```

Check what fixture name is used for a database instance in the existing
`test_engine_db.py` tests and use the same fixture — do not invent a new one.

---

## Validation

```bash
cd /mnt/e/HardlinkOrganizer
python -m pytest tests/test_hardlink_organizer.py tests/test_engine_db.py -x -q 2>&1 | tail -15
python -m pytest tests/ -x -q 2>&1 | tail -10
```

All tests must pass before committing.

---

## Commit

```bash
git add hardlink_organizer.py engine/db.py \
        tests/test_hardlink_organizer.py tests/test_engine_db.py
git commit -m "fix: warn on hardlink collision; chunk get_link_status for large libraries"
```

---

## What NOT to do

- Do not change `LinkResult`, `hardlink_tree`, or any callers of `hardlink_file`
- Do not change `record_link` or any other DB methods
- Do not add new dependencies
- Do not modify any other files
