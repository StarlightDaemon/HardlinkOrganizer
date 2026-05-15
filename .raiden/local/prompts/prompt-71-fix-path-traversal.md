# Prompt 71: Fix B1 — Path Traversal via dest_subpath

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off

## Goal

Fix a path traversal vulnerability in `LinkPlan.is_valid()`. A crafted
`dest_subpath` containing `../` sequences can produce a `dest_full` path that
escapes `dest_root`. Add a containment check so any such plan is rejected before
execution.

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## Read these files before touching anything

1. `hardlink_organizer.py` lines 655–741 — `LinkPlan` class and `build_link_plan`
2. `webapp/app.py` — find all call sites that pass `dest_subpath` from API input
3. `tests/test_hardlink_organizer.py` — find existing `LinkPlan` / `is_valid` tests
4. `tests/test_webapp.py` — find any link-plan route tests

---

## The problem

`LinkPlan.__init__` (line 671) builds `dest_full` by joining `dest_root` and
`dest_subpath` with the `/` operator:

```python
self.dest_full = str(Path(dest_root) / dest_subpath)
```

Python's `Path /` operator does not resolve `..` segments. A `dest_subpath` of
`../../etc` produces a `dest_full` of `<dest_root>/../../etc`, which resolves to
a path outside `dest_root`. `is_valid()` checks that `dest_root` exists but does
not verify that `dest_full` is actually contained within it.

---

## The fix — one addition to `is_valid()`

In `LinkPlan.is_valid()` (line 675), after the existing `dst_root.is_dir()`
check, add a containment check:

```python
# Ensure dest_full resolves to a path inside dest_root.
try:
    resolved_full = Path(self.dest_full).resolve()
    resolved_root = Path(self.dest_root).resolve()
    resolved_full.relative_to(resolved_root)
except ValueError:
    errors.append(
        f"Destination path escapes destination root: {self.dest_full}"
    )
```

`Path.relative_to()` raises `ValueError` if `resolved_full` is not under
`resolved_root`. No import is needed — `Path` is already imported.

Place this block inside the `if dst_root.is_dir():` guard (alongside the
existing device check), so it only runs when the root actually exists and
`.resolve()` has something real to work with.

---

## Add a test

In `tests/test_hardlink_organizer.py`, add a test for the traversal case.
Find the section with existing `LinkPlan` / `is_valid` tests and add alongside:

```python
def test_link_plan_rejects_dest_subpath_traversal(tmp_path):
    src_dir = tmp_path / "src" / "show"
    src_dir.mkdir(parents=True)
    dst_root = tmp_path / "dst"
    dst_root.mkdir()

    plan = LinkPlan(
        source_path=str(src_dir),
        dest_root=str(dst_root),
        dest_subpath="../../escaped",
        entry_type="directory",
        display_name="show",
    )
    ok, errors = plan.is_valid()
    assert not ok
    assert any("escapes" in e for e in errors)
```

---

## Validation

```bash
cd /mnt/e/HardlinkOrganizer
python -m pytest tests/test_hardlink_organizer.py -x -q 2>&1 | tail -10
python -m pytest tests/ -x -q 2>&1 | tail -10
```

All tests must pass before committing.

---

## Commit

```bash
git add hardlink_organizer.py tests/test_hardlink_organizer.py
git commit -m "fix: reject dest_subpath that escapes dest_root (path traversal)"
```

---

## What NOT to do

- Do not change `__init__`, `build_link_plan`, or any call site — the fix lives
  entirely in `is_valid()`
- Do not add validation at the API layer — defence in depth is fine later, but
  the engine is the authoritative safety boundary
- Do not modify any other files
