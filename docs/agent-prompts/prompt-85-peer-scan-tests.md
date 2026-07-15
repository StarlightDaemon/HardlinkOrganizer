# Prompt 85 — Behavioral Tests for Inode Peer Scan

**Target model:** Claude Sonnet 4.6 (thinking)
**Effort:** Medium — new test class, real filesystem setup with `os.link`
**Run order:** Run AFTER Prompts 83 and 84 are complete (depends on the
bounds-check added in Prompt 83 for correct path construction).

---

## Context

HardlinkOrganizer has a `GET /api/inventory/detail` endpoint (`webapp/app.py`)
that returns inode peer information for a selected source entry. The core of
this is `_find_dest_inode_peers` — a two-level filesystem walk that scans
configured `dest_sets` for files sharing the same (inode, device_id) as the
source file.

The current test suite (`tests/test_webapp.py`) has two tests for this
endpoint:
- `test_inventory_detail_happy_path` — asserts response shape only
- `test_inventory_detail_bad_source_set_returns_404` — 404 on unknown set

Neither test creates actual hardlinks or verifies that `_find_dest_inode_peers`
discovers correct peers. The behavioral logic — deduplication, cross-device
filtering, empty dest root — has zero coverage.

---

## Test harness background

`tests/test_webapp.py` does NOT use FastAPI's `TestClient`. It has a bespoke
`_RouteHarnessClient` that invokes route functions directly via
`asyncio.run(endpoint(**kwargs))`. The test class is `TestWebApp` with:
- `setUp`: creates a `tempfile.TemporaryDirectory`, builds a small source tree,
  calls `_make_cfg(src_root, dst_root, db_path)`, instantiates `Database` and
  `create_app`, and stores `self.client`.
- `_make_cfg` (line 42): returns a config dict with `source_sets: {"movies":
  src_root}` and `dest_sets: {"movies": dst_root}`.

To test peer discovery across a second dest set, a test must build its own cfg
dict directly rather than using `_make_cfg`, since `_make_cfg` only supports
one pair. Create a cfg with two entries in `dest_sets` pointing to two
separate temp dirs. Then create the app with `self._create_app(cfg, db, ...)`.

---

## New test class to add

Add a new test class `TestInventoryDetailPeerScan` at the bottom of
`tests/test_webapp.py`, **after** the existing `TestWebApp` class.

The class shares the same `setUpClass` pattern (import `Database` and
`create_app`). Each test method creates its own `tempfile.TemporaryDirectory`
and cleans it up in `tearDown`.

### Helper pattern

Each test will need a source file, a dest dir, and a hardlink. Use this
pattern to create a real hardlink (skip the test on non-Linux platforms where
`os.link` across directories may not work):

```python
@unittest.skipUnless(sys.platform.startswith("linux"), "hardlinks require Linux")
def test_...(self):
    ...
    os.link(src_file, dest_file)
    ...
```

### Tests to write

**1. `test_dest_peer_found_when_hardlinked`**

Setup:
- One source file: `{src_root}/Movie.A.mkv`
- One dest dir: `{dst_root}/Movie A/`
- Create a hardlink: `{dst_root}/Movie A/Movie A.mkv` → same inode as the source file
- Scan, then call `GET /api/inventory/detail?source_set=movies&full_path={src_file}`

Assert:
- `res.status_code == 200`
- `data["inode_peers"]` has exactly one entry
- The peer's `full_path` is the dest directory (`{dst_root}/Movie A`) — not the
  individual file, because `_find_dest_inode_peers` reports the top-level
  dir entry, not the matched sub-file
- The peer's `set_label` starts with `"dest:"`

**2. `test_no_peers_when_dest_root_empty`**

Setup:
- Source file exists; dest root exists but is empty
- No `os.link` call

Assert:
- `data["inode_peers"]` is an empty list (no dest peers)

**3. `test_dest_peer_deduplication`**

Setup:
- One source file: `{src_root}/Movie.B.mkv`
- One dest dir: `{dst_root}/Movie B/`
- Hardlink the source file to **two** files in that dir:
  `{dst_root}/Movie B/Movie B.mkv` and `{dst_root}/Movie B/Movie B.nfo`
  (use `shutil.copyfile` then `os.link` to create a second hardlinked file)

Assert:
- `data["inode_peers"]` has exactly **one** entry for the `Movie B` dir,
  not two — the deduplication in `_find_dest_inode_peers` must collapse
  multiple matching sub-files into one top-level peer

**4. `test_no_peers_when_file_not_hardlinked`**

Setup:
- Source file: `{src_root}/Movie.C.mkv`
- Dest dir contains a **copy** (not a hardlink): write different content to
  `{dst_root}/Movie C/Movie C.mkv` (different inode)

Assert:
- `data["inode_peers"]` is an empty list

**5. `test_full_path_outside_source_set_returns_400`**

(Tests the bounds check added by Prompt 83.)

No filesystem setup needed.

Call: `GET /api/inventory/detail?source_set=movies&full_path=/etc/passwd`

Assert: `res.status_code == 400`

---

## Notes on config setup for tests 1–4

For tests that need `_find_dest_inode_peers` to scan the dest root, build the
cfg like this (do not use `_make_cfg`):

```python
cfg = {
    "paths": {
        "index_json": str(root / "index.json"),
        "index_tsv":  str(root / "index.tsv"),
        "log_file":   None,
        "db_file":    str(root / "test.db"),
    },
    "settings": {"include_hidden": False, "collision_policy": "skip"},
    "source_sets": {"movies": src_root},
    "dest_sets":   {"movies": dst_root},
}
```

The `dest_sets` entry causes `_find_dest_inode_peers` to scan `dst_root`.

---

## Verification

```bash
cd E:\Citadel/HardlinkOrganizer && python -m unittest discover -s ./tests -v 2>&1 | tail -30
```

All existing tests must still pass. The five new tests must all pass (or be
correctly skipped on non-Linux). Report counts.

---

## Constraints

- Add only to `tests/test_webapp.py`. No other files.
- Use real `os.link` calls — do not mock filesystem operations.
- Do not modify `TestWebApp` or any existing test method.
- Keep each test method self-contained with its own temp dir.
- If `os.link` raises `OSError` for any reason in the test, let it propagate —
  the test should fail, not be silently skipped.
