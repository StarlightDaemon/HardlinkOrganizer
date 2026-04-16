"""
Tests for the verification engine (engine/verification.py).

All tests use real temporary directories on the local filesystem so that
os.stat(), os.link(), and os.symlink() behave exactly as they would on a
real host. No mocking of filesystem calls is needed for the happy paths.
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

_TOOL_DIR = Path(__file__).resolve().parent.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

from engine.db import Database
from engine.verification import (
    STATUS_VERIFIED_HARDLINKED,
    STATUS_EXISTS_BUT_NOT_HARDLINKED,
    STATUS_MISSING_AT_DESTINATION,
    STATUS_CANNOT_VERIFY_SYMLINK,
    STATUS_CANNOT_VERIFY_PERMISSION_ERROR,
    STATUS_CANNOT_VERIFY_CROSS_FILESYSTEM,
    _classify,
    _derive_dest_path,
    _iter_source_files,
    run_verification_for_link_history,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_file(path: Path, content: str = "data") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# _classify tests
# ---------------------------------------------------------------------------


class TestClassify(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_verified_hardlinked_when_inodes_match(self):
        src = self.root / "src.mkv"
        dst = self.root / "dst.mkv"
        _write_file(src)
        os.link(str(src), str(dst))

        status, *_ = _classify(str(src), str(dst))
        self.assertEqual(status, STATUS_VERIFIED_HARDLINKED)

    def test_missing_at_destination_when_dest_absent(self):
        src = self.root / "src.mkv"
        _write_file(src)
        dst = self.root / "nonexistent.mkv"

        status, *_ = _classify(str(src), str(dst))
        self.assertEqual(status, STATUS_MISSING_AT_DESTINATION)

    def test_exists_but_not_hardlinked_when_different_inode(self):
        src = self.root / "src.mkv"
        dst = self.root / "dst.mkv"
        _write_file(src, "original")
        _write_file(dst, "different content")

        src_ino = os.stat(str(src)).st_ino
        dst_ino = os.stat(str(dst)).st_ino
        # Only meaningful on the same filesystem; if we somehow got the same
        # inode this test environment is pathological, so guard:
        if src_ino == dst_ino:
            self.skipTest("Temp dir produced same inode for unrelated files")

        status, *_ = _classify(str(src), str(dst))
        self.assertEqual(status, STATUS_EXISTS_BUT_NOT_HARDLINKED)

    def test_cannot_verify_symlink_when_dest_is_symlink(self):
        src = self.root / "src.mkv"
        link = self.root / "link.mkv"
        _write_file(src)
        try:
            os.symlink(str(src), str(link))
        except (NotImplementedError, OSError):
            self.skipTest("Symlinks not supported on this platform/filesystem")

        status, *_ = _classify(str(src), str(link))
        self.assertEqual(status, STATUS_CANNOT_VERIFY_SYMLINK)

    def test_cannot_verify_permission_error_on_source(self):
        """Mock os.stat to simulate a PermissionError reading the source."""
        src = self.root / "src.mkv"
        _write_file(src)
        dst = self.root / "dst.mkv"
        _write_file(dst)

        with mock.patch("os.stat", side_effect=PermissionError("denied")):
            status, *_ = _classify(str(src), str(dst))
        self.assertEqual(status, STATUS_CANNOT_VERIFY_PERMISSION_ERROR)

    def test_classify_returns_stat_values_for_hardlink(self):
        src = self.root / "src.mkv"
        dst = self.root / "dst.mkv"
        _write_file(src)
        os.link(str(src), str(dst))

        (status, src_dev, src_ino, src_nlink,
         dst_dev, dst_ino, dst_nlink, notes) = _classify(str(src), str(dst))

        self.assertEqual(status, STATUS_VERIFIED_HARDLINKED)
        self.assertIsNotNone(src_ino)
        self.assertEqual(src_ino, dst_ino)
        self.assertEqual(src_dev, dst_dev)
        self.assertGreaterEqual(src_nlink, 2)


# ---------------------------------------------------------------------------
# _derive_dest_path tests
# ---------------------------------------------------------------------------


class TestDeriveDestPath(unittest.TestCase):

    def test_single_file_job(self):
        result = _derive_dest_path(
            source_file="/src/movie.mkv",
            source_root="/src/movie.mkv",
            dest_full="/dst/movies/Movie (2020)",
        )
        self.assertEqual(result, "/dst/movies/Movie (2020)")

    def test_directory_job_preserves_relative_path(self):
        result = _derive_dest_path(
            source_file="/src/MovieA/disc1/a.mkv",
            source_root="/src/MovieA",
            dest_full="/dst/movies/Movie A (2020)",
        )
        self.assertEqual(result, str(Path("/dst/movies/Movie A (2020)/disc1/a.mkv")))

    def test_top_level_file_in_directory_job(self):
        result = _derive_dest_path(
            source_file="/src/MovieA/main.mkv",
            source_root="/src/MovieA",
            dest_full="/dst/movies/Movie A (2020)",
        )
        self.assertEqual(result, str(Path("/dst/movies/Movie A (2020)/main.mkv")))


# ---------------------------------------------------------------------------
# _iter_source_files tests
# ---------------------------------------------------------------------------


class TestIterSourceFiles(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_yields_single_file(self):
        f = self.root / "a.mkv"
        _write_file(f)
        result = list(_iter_source_files(str(f)))
        self.assertEqual(result, [str(f)])

    def test_yields_all_files_in_directory(self):
        _write_file(self.root / "a.mkv")
        _write_file(self.root / "sub" / "b.mkv")
        result = set(_iter_source_files(str(self.root)))
        self.assertIn(str(self.root / "a.mkv"), result)
        self.assertIn(str(self.root / "sub" / "b.mkv"), result)

    def test_empty_directory_yields_nothing(self):
        empty = self.root / "empty"
        empty.mkdir()
        result = list(_iter_source_files(str(empty)))
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# run_verification_for_link_history integration tests
# ---------------------------------------------------------------------------


class TestRunVerificationForLinkHistory(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.src_dir = self.root / "src" / "MovieA"
        self.dst_dir = self.root / "dst" / "movies" / "Movie A (2020)"
        self.src_dir.mkdir(parents=True)
        self.dst_dir.mkdir(parents=True)

        # Write source files
        _write_file(self.src_dir / "a.mkv", "content_a")
        _write_file(self.src_dir / "b.mkv", "content_b")

        # Create hardlinks for one file
        os.link(
            str(self.src_dir / "a.mkv"),
            str(self.dst_dir / "a.mkv"),
        )
        # Leave b.mkv missing at destination

        self.db = Database(str(self.root / "test.db"))
        self._history_id = self.db.record_link(
            source_set="movies",
            real_name="MovieA",
            full_path=str(self.src_dir),
            dest_set="movies",
            dest_root=str(self.root / "dst" / "movies"),
            dest_subpath="Movie A (2020)",
            dest_full=str(self.dst_dir),
            linked_count=1,
            skipped_count=0,
            failed_count=0,
            dry_run=False,
            linked_at="2026-01-01T00:00:00Z",
        )

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def _history_record(self) -> dict:
        rows = self.db.get_history()
        return rows[0]

    def test_returns_positive_run_id(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        self.assertIsInstance(run_id, int)
        self.assertGreater(run_id, 0)

    def test_run_row_is_persisted(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        run = self.db.get_verification_run(run_id)
        self.assertIsNotNone(run)
        self.assertEqual(run["link_history_id"], self._history_id)
        self.assertEqual(run["mode"], "link_history")

    def test_summary_counts_are_correct(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        run = self.db.get_verification_run(run_id)
        # a.mkv hardlinked → verified; b.mkv absent → missing
        self.assertEqual(run["verified_count"], 1)
        self.assertEqual(run["missing_count"], 1)
        self.assertEqual(run["failed_count"], 0)
        self.assertEqual(run["error_count"], 0)

    def test_result_rows_cover_all_source_files(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        run = self.db.get_verification_run(run_id)
        self.assertEqual(len(run["results"]), 2)

    def test_result_statuses_are_correct(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        run = self.db.get_verification_run(run_id)
        statuses = {r["status"] for r in run["results"]}
        self.assertIn(STATUS_VERIFIED_HARDLINKED, statuses)
        self.assertIn(STATUS_MISSING_AT_DESTINATION, statuses)

    def test_verified_result_has_matching_inode_fields(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        run = self.db.get_verification_run(run_id)
        verified = [r for r in run["results"] if r["status"] == STATUS_VERIFIED_HARDLINKED]
        self.assertEqual(len(verified), 1)
        v = verified[0]
        self.assertIsNotNone(v["source_inode"])
        self.assertEqual(v["source_inode"], v["dest_inode"])
        self.assertEqual(v["source_dev"], v["dest_dev"])

    def test_missing_result_has_null_dest_fields(self):
        run_id = run_verification_for_link_history(self.db, self._history_record())
        run = self.db.get_verification_run(run_id)
        missing = [r for r in run["results"] if r["status"] == STATUS_MISSING_AT_DESTINATION]
        self.assertEqual(len(missing), 1)
        m = missing[0]
        self.assertIsNone(m["dest_inode"])
        self.assertIsNone(m["dest_dev"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
