# Agent Handoff — Refine check_already_linked to use nlink heuristic

You are refining an existing feature in the HardlinkOrganizer project at `/Users/dante/Citadel/HardlinkOrganizer`. Read every file referenced below before writing anything. The codebase is clean and consistent — match its style exactly.

---

## Context

`check_already_linked` was recently added to `hardlink_organizer.py`. It detects whether a source entry is already hardlinked into its paired destination by constructing `dest_root / source_entry_name` and comparing inodes. This fails when the destination was renamed by Radarr or Sonarr — the name no longer matches so the check returns False even though the file is already in the library.

The fix is to replace the name-match approach with an `st_nlink` heuristic: if any file inside the source entry has `nlink > 1`, it has at least one hardlink elsewhere on the same filesystem, which on a media server is a reliable proxy for "already in library." This is faster (one `stat` call, no dest path construction) and correct regardless of destination naming.

---

## Files to read in full before starting

- `hardlink_organizer.py` — the current `check_already_linked` implementation and `_stat_entry` for style reference
- `webapp/app.py` — the `get_inventory` endpoint, specifically the `dest_root` lookup and warning added in the last commit
- `tests/test_hardlink_organizer.py` — the existing `check_already_linked` tests to understand what needs updating

---

## Exact changes required

### 1. `hardlink_organizer.py` — rewrite `check_already_linked`

Remove the `dest_root` parameter entirely. The new signature:

```python
def check_already_linked(source_path: str) -> bool:
```

New logic:
- **For a file:** `return os.stat(source_path).st_nlink > 1`
- **For a directory:** use the existing two-level `os.scandir` traversal to find the first regular file, then return `os.stat(that_file).st_nlink > 1`
- Any `OSError` → return `False`
- Never raise

Keep the existing two-level directory traversal structure (top-level files first, then one subdirectory level). Only change: replace the inode/device comparison with a single `st_nlink > 1` check on the found file.

### 2. `webapp/app.py` — clean up `get_inventory`

Remove:
- The `dest_root = c["dest_sets"].get(source_set)` line
- The `if dest_root is None:` warning block and the `_logger.warning(...)` call
- The `if dest_root else False` conditional on the `check_already_linked` call

Replace the `already_linked` line with:

```python
already_linked=check_already_linked(e["full_path"]),
```

If `_logger` and the `logging` import are now unused after this removal, remove them too. Check carefully — `logging` may be used elsewhere in the file before removing it.

### 3. `tests/test_hardlink_organizer.py` — update existing tests

- Remove `dest_root` argument from all existing `check_already_linked` calls
- The test logic stays the same — `os.link` creates real hardlinks, so `nlink` will be `> 1` on linked files
- Update the test that checks `dest does not exist → returns False`: this case no longer applies since we're not checking dest at all. Replace it with: source file has `nlink == 1` (no hardlinks) → returns `False`
- Keep the directory tests — they still exercise the scandir traversal, just checking `nlink` instead of inode match
- Keep `test_dir_multiple_files_first_linked_returns_true`

---

## Constraints

- Do not touch `engine/db.py`, `webapp/models.py`, or `BrowseStep.tsx` — no changes needed there
- The `already_linked: bool` field on `InventoryEntry` stays as-is
- Do not add complexity — this is a simplification, not an expansion

---

## Verification

```bash
cd /Users/dante/Citadel/HardlinkOrganizer && python -m unittest discover -s ./tests -v
```

Report what passed, what failed, and what you changed.
