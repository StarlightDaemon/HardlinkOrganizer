# Agent Handoff — Filesystem-based hardlink detection

You are implementing a new feature in the HardlinkOrganizer project at `/Users/dante/Citadel/HardlinkOrganizer`. Read every file referenced below before writing a single line of code. The codebase is clean and consistent — match its style exactly.

---

## Feature: Filesystem-based hardlink detection

Currently the `linked` field on `InventoryEntry` is DB-only — it only knows about links HLO itself recorded. It knows nothing about hardlinks created by other tools. Add filesystem-level detection that checks whether a source entry is already hardlinked into its paired destination by comparing inodes on disk. Expose this as a new `already_linked` field on `InventoryEntry`, and add a hide-linked toggle to the Browse UI.

---

## Files to read in full before starting

- `hardlink_organizer.py` — focus on `scan_source_set` (line 238), `_stat_entry` (line 230), and `validate_same_device` (line 416) to understand how `st_dev`, `st_ino`, `st_nlink` are already used
- `webapp/app.py` — focus on `get_inventory` (line 271), specifically lines 282–326 where entries are built and `link_status` is annotated
- `webapp/models.py` — `InventoryEntry` (line 49); note that `linked: bool = False` is DB-based and must stay
- `engine/db.py` — `get_link_status` (line 321) so you understand what the existing `linked` field represents
- `webapp/frontend/src/components/steps/BrowseStep.tsx` — the full Browse UI component
- `tests/test_hardlink_organizer.py` — understand the test pattern before writing new tests

---

## Exact implementation required

### 1. `hardlink_organizer.py` — add a new function after `_stat_entry`

```python
def check_already_linked(source_path: str, dest_root: str) -> bool
```

- `source_path` is the full path to the top-level source entry (file or directory)
- `dest_root` is the destination set root
- **For a file entry:** construct `dest_path = Path(dest_root) / Path(source_path).name`. If `dest_path` exists and `os.stat(source_path).st_ino == os.stat(dest_path).st_ino` and `st_dev` match → return `True`.
- **For a directory entry:** construct `dest_dir = Path(dest_root) / Path(source_path).name`. If `dest_dir` does not exist → return `False`. Otherwise walk `source_path` (non-recursively via `os.scandir`) to find the first regular file. Construct the corresponding dest file path. If it exists and inodes and devices match → return `True`.
- Any `OSError` during stat → return `False` (path may not exist yet, that is normal).
- Never raise. This function is called in a hot path.

### 2. `webapp/models.py` — `InventoryEntry`

Add one field after `linked`:

```python
already_linked: bool = False   # filesystem inode check — true regardless of who created the link
```

### 3. `webapp/app.py` — `get_inventory` endpoint (line 271)

After the existing `link_status` block (lines 301–303), add:

```python
dest_root = c["dest_sets"].get(source_set)   # None if no matching dest key
```

Then when constructing each `InventoryEntryModel`, add:

```python
already_linked=check_already_linked(e["full_path"], dest_root) if dest_root else False,
```

Import `check_already_linked` from `hardlink_organizer` alongside the existing import of `scan_source_set`.

### 4. `webapp/frontend/src/components/steps/BrowseStep.tsx`

- Add local state: `const [hideLinked, setHideLinked] = useState(false);`
- Update the `filtered` computation: add `&& !(hideLinked && (e.linked || e.already_linked))` to the filter predicate
- Add a toggle button alongside the Re-scan button in `SectionHeader`'s `action` prop. Style it to match the existing Re-scan button. Label: `Hide linked` / `Show linked`.
- Update the `linked` column: if `row.already_linked` is true show a `StatusBadge` with `status='warning'` and `label='Linked (disk)'`. If `row.linked` (DB) is true show `status='success'` and `label='Linked (HLO)'`. Otherwise show `status='neutral'` and `label='Not linked'`. Rename the column header from `Linked` to `Status`.
- Add `useState` to the React import if not already present. Check the existing imports first.

### 5. `tests/test_hardlink_organizer.py` — add tests for `check_already_linked`

- Test: file entry, dest has same inode → returns `True`
- Test: file entry, dest has different inode → returns `False`
- Test: file entry, dest does not exist → returns `False`
- Test: directory entry, dest dir exists and first file matches inode → returns `True`
- Test: directory entry, dest dir does not exist → returns `False`
- Test: `OSError` on stat → returns `False` (simulate with a non-existent path)

Use `tempfile` and `os.link` to create real hardlinks in a temp directory, matching the test pattern already in the file.

---

## Constraints

- Do not modify `engine/db.py`, `get_link_status`, or the `linked` field — existing DB-based detection must continue to work unchanged
- The `already_linked` check is additive and independent — both signals coexist
- `check_already_linked` must be safe to call when the dest set does not have a matching key (the endpoint guards this with the `dest_root` None check)
- Do not add this to `scan_source_set` — keep detection at inventory-serve time so it reflects current disk state, not scan-time state
- Match all existing code style: no docstrings beyond a single short line, no comments unless the why is non-obvious

---

## Verification

After implementing, run the test suite:

```bash
cd /Users/dante/Citadel/HardlinkOrganizer && python -m unittest discover -s ./tests -v
```

Report what passed, what failed, and what you changed.
