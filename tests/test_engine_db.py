"""
Tests for the Database layer (engine/db.py).
"""
from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path

_TOOL_DIR = Path(__file__).resolve().parent.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

from engine.db import Database


def _fake_entries(source_set: str, count: int = 3, base_path: str = "/fake") -> list[dict]:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return [
        {
            "id": i,
            "source_set": source_set,
            "entry_type": "file",
            "display_name": f"Movie {i} (2020)",
            "real_name": f"Movie.{i}.2020.mkv",
            "full_path": f"{base_path}/Movie.{i}.2020.mkv",
            "size_bytes": i * 1_000_000,
            "device_id": 42,
            "scan_time": now,
        }
        for i in range(1, count + 1)
    ]


class TestDatabaseInit(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tmp.name) / "test.db")
        self.db = None

    def tearDown(self):
        if self.db:
            self.db.close()
        self.tmp.cleanup()

    def test_db_file_created(self):
        self.db = Database(self.db_path)
        self.assertTrue(Path(self.db_path).is_file())

    def test_schema_creates_tables(self):
        self.db = Database(self.db_path)
        conn = self.db._conn()
        tables = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        self.assertIn("scans", tables)
        self.assertIn("inventory", tables)
        self.assertIn("link_history", tables)

    def test_idempotent_init(self):
        """Opening the same DB twice should not raise."""
        db1 = Database(self.db_path)
        self.db = Database(self.db_path)
        db1.close()


class TestScanOperations(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "test.db"))

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_record_scan_returns_id(self):
        entries = _fake_entries("movies")
        scan_id = self.db.record_scan("movies", "2026-01-01T00:00:00Z", entries)
        self.assertIsInstance(scan_id, int)
        self.assertGreater(scan_id, 0)

    def test_multiple_scans_distinct_ids(self):
        entries = _fake_entries("movies")
        id1 = self.db.record_scan("movies", "2026-01-01T00:00:00Z", entries)
        id2 = self.db.record_scan("movies", "2026-01-02T00:00:00Z", entries)
        self.assertNotEqual(id1, id2)

    def test_get_latest_inventory_returns_entries(self):
        entries = _fake_entries("movies", count=5)
        self.db.record_scan("movies", "2026-01-01T00:00:00Z", entries)
        loaded = self.db.get_latest_inventory("movies")
        self.assertEqual(len(loaded), 5)

    def test_get_latest_inventory_returns_most_recent(self):
        entries_old = _fake_entries("movies", count=2)
        entries_new = _fake_entries("movies", count=4)
        self.db.record_scan("movies", "2026-01-01T00:00:00Z", entries_old)
        self.db.record_scan("movies", "2026-01-02T00:00:00Z", entries_new)
        loaded = self.db.get_latest_inventory("movies")
        self.assertEqual(len(loaded), 4)

    def test_get_latest_inventory_empty_for_unknown_set(self):
        loaded = self.db.get_latest_inventory("no_such_set")
        self.assertEqual(loaded, [])

    def test_get_scan_summary_returns_dict(self):
        entries = _fake_entries("shows", count=3)
        scan_time = "2026-01-01T12:00:00Z"
        self.db.record_scan("shows", scan_time, entries)
        summary = self.db.get_scan_summary("shows")
        self.assertIsNotNone(summary)
        self.assertEqual(summary["scan_time"], scan_time)
        self.assertEqual(summary["entry_count"], 3)

    def test_get_last_scan_time(self):
        self.db.record_scan("movies", "2026-01-01T00:00:00Z", _fake_entries("movies"))
        self.db.record_scan("movies", "2026-02-01T00:00:00Z", _fake_entries("movies"))
        t = self.db.get_last_scan_time("movies")
        self.assertEqual(t, "2026-02-01T00:00:00Z")

    def test_get_last_scan_time_none_for_unknown(self):
        t = self.db.get_last_scan_time("no_such_set")
        self.assertIsNone(t)

    def test_inventory_entries_have_sequential_ids(self):
        entries = _fake_entries("movies", count=5)
        self.db.record_scan("movies", "2026-01-01T00:00:00Z", entries)
        loaded = self.db.get_latest_inventory("movies")
        ids = [e["id"] for e in loaded]
        self.assertEqual(ids, list(range(1, 6)))

    def test_empty_scan_allowed(self):
        scan_id = self.db.record_scan("movies", "2026-01-01T00:00:00Z", [])
        self.assertGreater(scan_id, 0)
        loaded = self.db.get_latest_inventory("movies")
        self.assertEqual(loaded, [])


class TestLinkHistory(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "test.db"))

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def _record(self, **kwargs) -> int:
        defaults = dict(
            source_set="movies",
            real_name="Movie.2020.mkv",
            full_path="/fake/Movie.2020.mkv",
            dest_set="movies",
            dest_root="/dest/movies",
            dest_subpath="Movie (2020)",
            dest_full="/dest/movies/Movie (2020)",
            linked_count=3,
            skipped_count=0,
            failed_count=0,
            dry_run=False,
            linked_at="2026-01-01T00:00:00Z",
        )
        defaults.update(kwargs)
        return self.db.record_link(**defaults)

    def test_record_link_returns_id(self):
        hid = self._record()
        self.assertIsInstance(hid, int)
        self.assertGreater(hid, 0)

    def test_get_history_returns_records(self):
        self._record()
        self._record(real_name="Other.2021.mkv", full_path="/fake/Other.2021.mkv")
        history = self.db.get_history()
        self.assertEqual(len(history), 2)

    def test_get_history_newest_first(self):
        id1 = self._record(linked_at="2026-01-01T00:00:00Z")
        id2 = self._record(linked_at="2026-01-02T00:00:00Z")
        history = self.db.get_history()
        self.assertEqual(history[0]["id"], id2)
        self.assertEqual(history[1]["id"], id1)

    def test_get_history_limit(self):
        for i in range(10):
            self._record(real_name=f"Movie{i}.mkv", full_path=f"/fake/m{i}.mkv")
        history = self.db.get_history(limit=5)
        self.assertEqual(len(history), 5)

    def test_get_history_filter_by_set(self):
        self._record(source_set="movies")
        self._record(source_set="shows", real_name="Show.s01.mkv", full_path="/fake/s.mkv", dest_set="shows")
        movies = self.db.get_history(source_set="movies")
        self.assertEqual(len(movies), 1)
        self.assertEqual(movies[0]["source_set"], "movies")

    def test_get_link_history_record(self):
        hid = self._record(source_set="movies", real_name="Movie.2020.mkv")
        record = self.db.get_link_history_record(hid)
        self.assertIsNotNone(record)
        self.assertEqual(record["id"], hid)
        self.assertEqual(record["source_set"], "movies")
        self.assertEqual(record["real_name"], "Movie.2020.mkv")

    def test_get_link_history_record_not_found(self):
        record = self.db.get_link_history_record(999999)
        self.assertIsNone(record)

    def test_is_linked_true_after_real_link(self):
        self._record(full_path="/fake/m.mkv", linked_count=5, dry_run=False)
        self.assertTrue(self.db.is_linked("/fake/m.mkv"))

    def test_is_linked_false_for_dry_run_only(self):
        self._record(full_path="/fake/m.mkv", linked_count=5, dry_run=True)
        self.assertFalse(self.db.is_linked("/fake/m.mkv"))

    def test_is_linked_false_when_zero_linked(self):
        self._record(full_path="/fake/m.mkv", linked_count=0)
        self.assertFalse(self.db.is_linked("/fake/m.mkv"))

    def test_get_link_status_batch(self):
        self._record(full_path="/fake/a.mkv", linked_count=1, dry_run=False)
        self._record(full_path="/fake/b.mkv", linked_count=1, dry_run=True)  # dry only
        status = self.db.get_link_status(["/fake/a.mkv", "/fake/b.mkv", "/fake/c.mkv"])
        self.assertTrue(status["/fake/a.mkv"])
        self.assertFalse(status["/fake/b.mkv"])
        self.assertFalse(status["/fake/c.mkv"])

    def test_get_link_status_empty_input(self):
        result = self.db.get_link_status([])
        self.assertEqual(result, {})

    def test_dry_run_field_stored_correctly(self):
        self._record(dry_run=True)
        history = self.db.get_history()
        self.assertEqual(history[0]["dry_run"], 1)  # stored as int in SQLite


class TestVerificationDB(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "test.db"))
        # Insert a real link_history row so FK references work
        self._history_id = self.db.record_link(
            source_set="movies",
            real_name="Movie.2020.mkv",
            full_path="/fake/Movie.2020.mkv",
            dest_set="movies",
            dest_root="/dest/movies",
            dest_subpath="Movie (2020)",
            dest_full="/dest/movies/Movie (2020)",
            linked_count=1,
            skipped_count=0,
            failed_count=0,
            dry_run=False,
            linked_at="2026-01-01T00:00:00Z",
        )

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_schema_creates_verification_tables(self):
        conn = self.db._conn()
        tables = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        self.assertIn("verification_runs", tables)
        self.assertIn("verification_results", tables)

    def test_create_verification_run_returns_id(self):
        run_id = self.db.create_verification_run(
            created_at="2026-01-01T00:00:00Z",
            mode="link_history",
            link_history_id=self._history_id,
        )
        self.assertIsInstance(run_id, int)
        self.assertGreater(run_id, 0)

    def test_create_verification_run_multiple_distinct_ids(self):
        id1 = self.db.create_verification_run(created_at="2026-01-01T00:00:00Z")
        id2 = self.db.create_verification_run(created_at="2026-01-02T00:00:00Z")
        self.assertNotEqual(id1, id2)

    def test_record_verification_result_returns_id(self):
        run_id = self.db.create_verification_run(created_at="2026-01-01T00:00:00Z")
        result_id = self.db.record_verification_result(
            run_id=run_id,
            source_path="/fake/a.mkv",
            candidate_dest="/dest/a.mkv",
            source_dev=42,
            source_inode=100,
            source_nlink=2,
            dest_dev=42,
            dest_inode=100,
            dest_nlink=2,
            status="verified_hardlinked",
        )
        self.assertIsInstance(result_id, int)
        self.assertGreater(result_id, 0)

    def test_update_verification_run_summary_reflects_counts(self):
        run_id = self.db.create_verification_run(created_at="2026-01-01T00:00:00Z")
        self.db.update_verification_run_summary(
            run_id=run_id,
            verified_count=5,
            failed_count=2,
            missing_count=1,
            error_count=0,
        )
        run = self.db.get_verification_run(run_id)
        self.assertEqual(run["verified_count"], 5)
        self.assertEqual(run["failed_count"], 2)
        self.assertEqual(run["missing_count"], 1)
        self.assertEqual(run["error_count"], 0)

    def test_get_verification_run_returns_none_for_unknown(self):
        result = self.db.get_verification_run(999999)
        self.assertIsNone(result)

    def test_get_verification_run_includes_result_rows(self):
        run_id = self.db.create_verification_run(created_at="2026-01-01T00:00:00Z")
        self.db.record_verification_result(
            run_id=run_id,
            source_path="/fake/a.mkv",
            candidate_dest="/dest/a.mkv",
            source_dev=42, source_inode=100, source_nlink=2,
            dest_dev=42, dest_inode=100, dest_nlink=2,
            status="verified_hardlinked",
        )
        self.db.record_verification_result(
            run_id=run_id,
            source_path="/fake/b.mkv",
            candidate_dest="/dest/b.mkv",
            source_dev=42, source_inode=200, source_nlink=1,
            dest_dev=None, dest_inode=None, dest_nlink=None,
            status="missing_at_destination",
        )
        run = self.db.get_verification_run(run_id)
        self.assertIsNotNone(run)
        self.assertEqual(len(run["results"]), 2)
        statuses = {r["status"] for r in run["results"]}
        self.assertIn("verified_hardlinked", statuses)
        self.assertIn("missing_at_destination", statuses)

    def test_get_verification_run_result_fields_present(self):
        run_id = self.db.create_verification_run(created_at="2026-01-01T00:00:00Z")
        self.db.record_verification_result(
            run_id=run_id,
            source_path="/src/x.mkv",
            candidate_dest="/dst/x.mkv",
            source_dev=7, source_inode=3, source_nlink=1,
            dest_dev=7, dest_inode=9, dest_nlink=1,
            status="exists_but_not_hardlinked",
            notes="different inode",
        )
        run = self.db.get_verification_run(run_id)
        r = run["results"][0]
        self.assertEqual(r["source_path"], "/src/x.mkv")
        self.assertEqual(r["candidate_dest"], "/dst/x.mkv")
        self.assertEqual(r["source_inode"], 3)
        self.assertEqual(r["dest_inode"], 9)
        self.assertEqual(r["notes"], "different inode")


class TestDestinationDB(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "test.db"))

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def _add(self, label="Movies Dest", path="/dest/movies", **kwargs) -> int:
        now = "2026-01-01T00:00:00Z"
        return self.db.add_destination(
            label=label,
            path=path,
            tag=kwargs.get("tag"),
            enabled=kwargs.get("enabled", True),
            notes=kwargs.get("notes"),
            created_at=now,
            updated_at=now,
        )

    def test_schema_creates_destinations_table(self):
        conn = self.db._conn()
        tables = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        self.assertIn("destinations", tables)

    def test_add_destination_returns_id(self):
        dest_id = self._add()
        self.assertIsInstance(dest_id, int)
        self.assertGreater(dest_id, 0)

    def test_list_destinations_empty(self):
        self.assertEqual(self.db.list_destinations(), [])

    def test_list_destinations_returns_all(self):
        self._add(label="Movies", path="/dest/movies")
        self._add(label="Shows", path="/dest/shows")
        rows = self.db.list_destinations()
        self.assertEqual(len(rows), 2)

    def test_get_destination_returns_row(self):
        dest_id = self._add(label="Movies", path="/dest/movies", tag="media", notes="main")
        row = self.db.get_destination(dest_id)
        self.assertIsNotNone(row)
        self.assertEqual(row["label"], "Movies")
        self.assertEqual(row["path"], "/dest/movies")
        self.assertEqual(row["tag"], "media")
        self.assertEqual(row["notes"], "main")
        self.assertEqual(row["enabled"], 1)

    def test_get_destination_not_found(self):
        self.assertIsNone(self.db.get_destination(999999))

    def test_update_destination_label(self):
        dest_id = self._add(label="Old Label")
        updated = self.db.update_destination(dest_id, label="New Label", updated_at="2026-02-01T00:00:00Z")
        self.assertTrue(updated)
        row = self.db.get_destination(dest_id)
        self.assertEqual(row["label"], "New Label")

    def test_update_destination_enabled_false(self):
        dest_id = self._add(enabled=True)
        self.db.update_destination(dest_id, enabled=False, updated_at="2026-02-01T00:00:00Z")
        row = self.db.get_destination(dest_id)
        self.assertEqual(row["enabled"], 0)

    def test_update_destination_not_found_returns_false(self):
        result = self.db.update_destination(999999, label="X", updated_at="2026-01-01T00:00:00Z")
        self.assertFalse(result)

    def test_delete_destination_removes_row(self):
        dest_id = self._add()
        deleted = self.db.delete_destination(dest_id)
        self.assertTrue(deleted)
        self.assertIsNone(self.db.get_destination(dest_id))

    def test_delete_destination_not_found_returns_false(self):
        self.assertFalse(self.db.delete_destination(999999))

    def test_path_unique_constraint(self):
        self._add(path="/dest/movies")
        with self.assertRaises(Exception):
            self._add(path="/dest/movies")

    def test_list_destinations_ordered_by_id(self):
        id1 = self._add(label="A", path="/dest/a")
        id2 = self._add(label="B", path="/dest/b")
        rows = self.db.list_destinations()
        self.assertEqual(rows[0]["id"], id1)
        self.assertEqual(rows[1]["id"], id2)


if __name__ == "__main__":
    unittest.main(verbosity=2)

