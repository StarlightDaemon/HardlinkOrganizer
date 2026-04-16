"""
Smoke test for hardlink_organizer -- scan, dry-run link, real link, collision skip.
Run from repo root:
    py ./tests/smoke_test.py
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

# Ensure the tool module is importable regardless of cwd
_HERE = Path(__file__).resolve().parent
_TOOL_DIR = _HERE.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

import hardlink_organizer as hlo

PASS = "PASS"
FAIL = "FAIL"
_results: list[tuple[str, str]] = []


def check(label: str, value: bool) -> None:
    status = PASS if value else FAIL
    _results.append((status, label))
    mark = "+" if value else "X"
    print(f"  [{mark}] {label}")


def main() -> int:
    print("\n== Hardlink Organizer Smoke Test ===========================\n")

    tmp = tempfile.mkdtemp(prefix="hlh_smoke_")
    try:
        src = Path(tmp) / "ingress" / "movies"
        dst = Path(tmp) / "library" / "movies"
        src.mkdir(parents=True)
        dst.mkdir(parents=True)

        # Build a small source tree
        (src / "Interstellar.2014.BluRay.mkv").write_text("fake film", encoding="utf-8")
        show = src / "The.Expanse.S01"
        show.mkdir()
        (show / "S01E01.mkv").write_text("ep1", encoding="utf-8")
        (show / "S01E02.mkv").write_text("ep2", encoding="utf-8")
        (show / "extras").mkdir()
        (show / "extras" / "featurette.mkv").write_text("bonus", encoding="utf-8")

        index_json = str(Path(tmp) / "index.json")
        index_tsv = str(Path(tmp) / "index.tsv")

        # Write config TOML (forward slashes work on Windows too inside TOML strings)
        config_path = Path(tmp) / "config.toml"
        config_path.write_text(
            "[paths]\n"
            + 'index_json = "' + index_json.replace("\\", "/") + '"\n'
            + 'index_tsv  = "' + index_tsv.replace("\\", "/") + '"\n\n'
            + "[settings]\n"
            + "include_hidden = false\n\n"
            + "[source_sets]\n"
            + 'movies = "' + str(src).replace("\\", "/") + '"\n\n'
            + "[dest_sets]\n"
            + 'movies = "' + str(dst).replace("\\", "/") + '"\n',
            encoding="utf-8",
        )

        hlo.setup_logging(None)
        cfg = hlo.load_config(str(config_path))

        # -- Phase 1: scan ------------------------------------------------
        print("Phase 1 - Scan")
        entries = hlo.scan_all_sets(cfg)
        hlo.write_index_json(entries, index_json)
        hlo.write_index_tsv(entries, index_tsv)

        check("scan returns 2 top-level entries", len(entries) == 2)
        check("JSON index file created", Path(index_json).is_file())
        check("TSV index file created", Path(index_tsv).is_file())

        file_entry = next((e for e in entries if e["entry_type"] == "file"), None)
        dir_entry = next((e for e in entries if e["entry_type"] == "dir"), None)
        check("file entry found", file_entry is not None)
        check("dir entry found", dir_entry is not None)

        if file_entry:
            check("file display_name contains year", "2014" in file_entry["display_name"])
            check("file real_name unchanged", file_entry["real_name"] == "Interstellar.2014.BluRay.mkv")

        # -- Phase 2: dry-run link on a directory -------------------------
        print("\nPhase 2 - Dry-run Link (directory)")
        assert dir_entry is not None
        plan = hlo.build_link_plan(dir_entry, dest_root=str(dst), dest_subpath=None)
        plan.print_preview()
        ok, errors = plan.is_valid()
        check("link plan is valid", ok)

        res_dry = hlo.execute_link_plan(plan, dry_run=True)
        assert res_dry is not None
        check("dry-run counts 3 files", res_dry.total == 3)
        check("dry-run creates no files on disk", not (dst / plan.dest_subpath).exists())

        # -- Phase 3: real link -------------------------------------------
        print("\nPhase 3 - Real Link (directory)")
        res_real = hlo.execute_link_plan(plan, dry_run=False)
        assert res_real is not None
        check("real link: 3 files linked", len(res_real.linked) == 3)
        check("real link: 0 skipped", len(res_real.skipped) == 0)
        check("real link: 0 failed", len(res_real.failed) == 0)
        res_real.print_summary()

        # Verify hardlink inode sharing
        dst_show = dst / plan.dest_subpath
        src_ep1 = show / "S01E01.mkv"
        dst_ep1 = dst_show / "S01E01.mkv"
        if dst_ep1.exists():
            same_inode = os.stat(src_ep1).st_ino == os.stat(dst_ep1).st_ino
            check("shared inode (true hardlink)", same_inode)
        else:
            check("shared inode (true hardlink)", False)

        check("source tree unchanged (dir exists)", show.is_dir())
        check("source file intact", (show / "S01E01.mkv").read_text(encoding="utf-8") == "ep1")
        check("nested subdir hardlinked", (dst_show / "extras" / "featurette.mkv").exists())

        # -- Phase 4: collision run -- all should skip --------------------
        print("\nPhase 4 - Collision Run (all existing -> skip)")
        res_coll = hlo.execute_link_plan(plan, dry_run=False)
        assert res_coll is not None
        check("collision run: 0 linked", len(res_coll.linked) == 0)
        check("collision run: 3 skipped", len(res_coll.skipped) == 3)
        check(
            "existing files NOT overwritten",
            (dst_show / "S01E01.mkv").read_text(encoding="utf-8") == "ep1",
        )
        res_coll.print_summary()

        # -- Phase 5: same-device validation ------------------------------
        print("\nPhase 5 - validate_same_device")
        same = hlo.validate_same_device(str(src), str(dst))
        check("same-device check returns True for same tmp dir", same)

    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # -- Report -----------------------------------------------------------
    print("\n== Results =====================================================")
    passed = sum(1 for s, _ in _results if s == PASS)
    failed = sum(1 for s, _ in _results if s == FAIL)
    print(f"  Passed: {passed} / {len(_results)}")
    if failed:
        print(f"  FAILED: {failed}")
        for s, label in _results:
            if s == FAIL:
                print(f"    [X] {label}")
        return 1
    print("  All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
