"""
Tests for hardlink_organizer.py

Run with:
    python -m unittest discover -s ./tests -v

Or from the repo root:
    python -m unittest discover -s ./tests -v

Or directly (no package needed):
    python ./tests/test_hardlink_organizer.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Allow running the test file directly or via unittest discover from the repo root.
_HERE = Path(__file__).resolve().parent
_TOOL_DIR = _HERE.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

import hardlink_organizer as hlo  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_file(path: Path, content: str = "data") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _make_minimal_config(src_root: str, dst_root: str) -> hlo.Config:
    return {
        "paths": {
            "index_json": str(Path(src_root).parent / "index.json"),
            "index_tsv": str(Path(src_root).parent / "index.tsv"),
            "log_file": None,
        },
        "settings": {
            "include_hidden": False,
            "collision_policy": "skip",
        },
        "source_sets": {"test_src": src_root},
        "dest_sets": {"test_dst": dst_root},
    }


# ---------------------------------------------------------------------------
# Display-name tests
# ---------------------------------------------------------------------------

class TestGenerateDisplayName(unittest.TestCase):

    def test_dots_replaced_with_spaces(self):
        self.assertEqual(hlo.generate_display_name("The.Big.Short.2015"), "The Big Short (2015)")

    def test_underscores_replaced_with_spaces(self):
        result = hlo.generate_display_name("My_Neighbour_Totoro")
        self.assertIn("My", result)
        self.assertNotIn("_", result)

    def test_year_token_preserved(self):
        result = hlo.generate_display_name("Blade.Runner.1982.BluRay")
        self.assertIn("1982", result)

    def test_year_parenthesised(self):
        result = hlo.generate_display_name("Blade.Runner.1982.BluRay")
        self.assertIn("(1982)", result)

    def test_no_year(self):
        result = hlo.generate_display_name("My.Neighbours.Totoro")
        self.assertNotIn("(", result)

    def test_already_parenthesised_year_not_doubled(self):
        # Display name generation is applied to real_name, which won't have parens,
        # but test the regex doesn't double-wrap if somehow given one.
        result = hlo.generate_display_name("Blade.Runner.(1982).BluRay")
        self.assertIn("(1982)", result)
        self.assertNotIn("((1982))", result)

    def test_whitespace_collapsed(self):
        result = hlo.generate_display_name("  The   Thing  ")
        self.assertNotIn("  ", result)
        self.assertEqual(result, result.strip())

    def test_extension_stripped_for_video(self):
        result = hlo.generate_display_name("Arrival.2016.mkv")
        self.assertNotIn(".mkv", result)
        self.assertIn("(2016)", result)

    def test_extension_not_stripped_for_dir(self):
        # Directories don't have recognisable extensions so they pass through.
        result = hlo.generate_display_name("The.Expanse.S01")
        self.assertIn("The", result)
        self.assertIn("Expanse", result)
        self.assertIn("S01", result)

    def test_mixed_dots_and_underscores(self):
        result = hlo.generate_display_name("Dark_Matter.S01.E02.mkv")
        self.assertNotIn("_", result)
        self.assertNotIn(".", result)


class TestVersioning(unittest.TestCase):

    def test_version_constant_present(self):
        self.assertEqual(hlo.__version__, "0.3.0")


# ---------------------------------------------------------------------------
# Config loading tests (requires tomllib / tomli)
# ---------------------------------------------------------------------------

class TestLoadConfig(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.config_path = Path(self.tmp.name) / "config.toml"

    def tearDown(self):
        self.tmp.cleanup()

    def _write_config(self, content: str) -> str:
        self.config_path.write_text(content, encoding="utf-8")
        return str(self.config_path)

    @unittest.skipIf(hlo.tomllib is None, "No TOML library available")
    def test_valid_config_loads(self):
        path = self._write_config(
            '[source_sets]\nmovies = "/tmp/movies"\n'
            '[dest_sets]\nmovies = "/tmp/dest_movies"\n'
            '[paths]\nindex_json = "/tmp/index.json"\n'
            '[settings]\ninclude_hidden = false\n'
        )
        cfg = hlo.load_config(path)
        self.assertIn("movies", cfg["source_sets"])
        self.assertEqual(cfg["source_sets"]["movies"], "/tmp/movies")

    @unittest.skipIf(hlo.tomllib is None, "No TOML library available")
    def test_missing_config_file_exits(self):
        # 0.2.0+: raises ConfigError instead of calling sys.exit()
        with self.assertRaises(hlo.ConfigError):
            hlo.load_config("/nonexistent/path/config.toml")

    @unittest.skipIf(hlo.tomllib is None, "No TOML library available")
    def test_empty_source_sets_warns_but_loads(self):
        path = self._write_config('[dest_sets]\nmovies = "/tmp/m"\n')
        # Should not raise; may warn via logging
        cfg = hlo.load_config(path)
        self.assertEqual(cfg["source_sets"], {})


# ---------------------------------------------------------------------------
# Scanning tests
# ---------------------------------------------------------------------------

class TestScanSourceSet(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_scan_empty_dir(self):
        entries = hlo.scan_source_set("test", str(self.root))
        self.assertEqual(entries, [])

    def test_scan_files(self):
        _write_file(self.root / "alpha.mkv")
        _write_file(self.root / "beta.mkv")
        entries = hlo.scan_source_set("test", str(self.root))
        names = [e["real_name"] for e in entries]
        self.assertIn("alpha.mkv", names)
        self.assertIn("beta.mkv", names)

    def test_scan_dirs(self):
        (self.root / "ShowA").mkdir()
        (self.root / "ShowB").mkdir()
        entries = hlo.scan_source_set("test", str(self.root))
        types = {e["real_name"]: e["entry_type"] for e in entries}
        self.assertEqual(types["ShowA"], "dir")
        self.assertEqual(types["ShowB"], "dir")

    def test_dirs_before_files(self):
        _write_file(self.root / "aaa_file.mkv")
        (self.root / "zzz_dir").mkdir()
        entries = hlo.scan_source_set("test", str(self.root))
        self.assertEqual(entries[0]["real_name"], "zzz_dir")
        self.assertEqual(entries[1]["real_name"], "aaa_file.mkv")

    def test_hidden_excluded_by_default(self):
        _write_file(self.root / ".hidden_file")
        (self.root / ".hidden_dir").mkdir()
        _write_file(self.root / "visible.mkv")
        entries = hlo.scan_source_set("test", str(self.root))
        names = [e["real_name"] for e in entries]
        self.assertNotIn(".hidden_file", names)
        self.assertNotIn(".hidden_dir", names)
        self.assertIn("visible.mkv", names)

    def test_hidden_included_when_flag_set(self):
        _write_file(self.root / ".hidden_file")
        entries = hlo.scan_source_set("test", str(self.root), include_hidden=True)
        names = [e["real_name"] for e in entries]
        self.assertIn(".hidden_file", names)

    def test_ids_are_sequential_and_unique(self):
        for name in ("c.mkv", "a.mkv", "b.mkv"):
            _write_file(self.root / name)
        entries = hlo.scan_source_set("test", str(self.root))
        ids = [e["id"] for e in entries]
        self.assertEqual(ids, list(range(1, len(ids) + 1)))

    def test_nonexistent_root_returns_empty(self):
        entries = hlo.scan_source_set("test", "/nonexistent/path/xyz")
        self.assertEqual(entries, [])

    def test_source_set_name_stored(self):
        _write_file(self.root / "movie.mkv")
        entries = hlo.scan_source_set("movies", str(self.root))
        self.assertEqual(entries[0]["source_set"], "movies")

    def test_full_path_is_absolute(self):
        _write_file(self.root / "movie.mkv")
        entries = hlo.scan_source_set("movies", str(self.root))
        self.assertTrue(Path(entries[0]["full_path"]).is_absolute())

    def test_display_name_differs_from_real_name(self):
        _write_file(self.root / "The.Dark.Knight.2008.mkv")
        entries = hlo.scan_source_set("movies", str(self.root))
        e = entries[0]
        self.assertEqual(e["real_name"], "The.Dark.Knight.2008.mkv")
        self.assertNotEqual(e["display_name"], e["real_name"])
        self.assertIn("2008", e["display_name"])

    def test_deterministic_order(self):
        for name in ("Zebra.2020.mkv", "Apple.2010.mkv", "Mango.2015.mkv"):
            _write_file(self.root / name)
        entries1 = hlo.scan_source_set("movies", str(self.root))
        entries2 = hlo.scan_source_set("movies", str(self.root))
        self.assertEqual(
            [e["real_name"] for e in entries1],
            [e["real_name"] for e in entries2],
        )


# ---------------------------------------------------------------------------
# Index write/read tests
# ---------------------------------------------------------------------------

class TestIndexPersistence(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def _sample_entries(self) -> list[hlo.InventoryEntry]:
        src = self.root / "src"
        src.mkdir()
        _write_file(src / "Movie.2020.mkv")
        return hlo.scan_source_set("movies", str(src))

    def test_write_and_reload_json(self):
        entries = self._sample_entries()
        json_path = str(self.root / "index.json")
        hlo.write_index_json(entries, json_path)
        loaded = hlo.load_index(json_path)
        self.assertEqual(len(loaded), len(entries))
        self.assertEqual(loaded[0]["real_name"], entries[0]["real_name"])

    def test_write_tsv_creates_file(self):
        entries = self._sample_entries()
        tsv_path = str(self.root / "index.tsv")
        hlo.write_index_tsv(entries, tsv_path)
        self.assertTrue(Path(tsv_path).is_file())

    def test_tsv_has_header(self):
        entries = self._sample_entries()
        tsv_path = str(self.root / "index.tsv")
        hlo.write_index_tsv(entries, tsv_path)
        with open(tsv_path, encoding="utf-8") as fh:
            header = fh.readline()
        self.assertIn("real_name", header)

    def test_load_nonexistent_returns_empty(self):
        result = hlo.load_index("/nonexistent/path/index.json")
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

class TestValidation(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_validate_source_existing(self):
        f = self.root / "file.mkv"
        _write_file(f)
        entry: hlo.InventoryEntry = {
            "id": 1, "source_set": "x", "entry_type": "file",
            "display_name": "File", "real_name": "file.mkv",
            "full_path": str(f), "scan_time": "t", "size_bytes": 4, "device_id": 0,
        }
        self.assertTrue(hlo.validate_source(entry))

    def test_validate_source_missing(self):
        entry: hlo.InventoryEntry = {
            "id": 1, "source_set": "x", "entry_type": "file",
            "display_name": "File", "real_name": "gone.mkv",
            "full_path": "/nonexistent/gone.mkv", "scan_time": "t",
            "size_bytes": 0, "device_id": 0,
        }
        self.assertFalse(hlo.validate_source(entry))

    def test_validate_dest_root_existing(self):
        self.assertTrue(hlo.validate_dest_root(str(self.root)))

    def test_validate_dest_root_missing(self):
        self.assertFalse(hlo.validate_dest_root("/nonexistent/path/xyz"))

    def test_validate_same_device_same(self):
        src = self.root / "src"
        src.mkdir()
        dst = self.root / "dst"
        dst.mkdir()
        # Same temp directory — guaranteed same device.
        self.assertTrue(hlo.validate_same_device(str(src), str(dst)))

    def test_validate_same_device_path_check(self):
        # Just confirm the function returns a bool without crashing.
        result = hlo.validate_same_device(str(self.root), str(self.root))
        self.assertIsInstance(result, bool)


# ---------------------------------------------------------------------------
# LinkPlan validation tests
# ---------------------------------------------------------------------------

class TestLinkPlan(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def _make_plan(self, src: str, dst_root: str, subpath: str = "dest") -> hlo.LinkPlan:
        return hlo.LinkPlan(
            source_path=src,
            dest_root=dst_root,
            dest_subpath=subpath,
            entry_type="file",
            display_name="Test File",
        )

    def test_valid_plan(self):
        src_file = self.root / "source.mkv"
        _write_file(src_file)
        dst_root = self.root / "dest"
        dst_root.mkdir()
        plan = self._make_plan(str(src_file), str(dst_root))
        ok, errors = plan.is_valid()
        self.assertTrue(ok)
        self.assertEqual(errors, [])

    def test_missing_source_fails(self):
        dst_root = self.root / "dest"
        dst_root.mkdir()
        plan = self._make_plan("/nonexistent/source.mkv", str(dst_root))
        ok, errors = plan.is_valid()
        self.assertFalse(ok)
        self.assertTrue(any("Source does not exist" in e for e in errors))

    def test_missing_dest_root_fails(self):
        src_file = self.root / "source.mkv"
        _write_file(src_file)
        plan = self._make_plan(str(src_file), "/nonexistent/dest")
        ok, errors = plan.is_valid()
        self.assertFalse(ok)
        self.assertTrue(any("Destination root" in e for e in errors))


class TestMountLayoutAssessment(unittest.TestCase):

    def test_warns_for_mnt_user_paths(self):
        assessment = hlo.assess_mount_layout(
            "/mnt/user/ingress/movie.mkv",
            "/mnt/user/media",
            source_device=11,
            dest_device=11,
            mountinfo_text=(
                "24 1 0:43 / /mnt/user rw,relatime - fuse.shfs shfs rw\n"
            ),
        )
        codes = {warning.code for warning in assessment.warnings}
        self.assertIn("unraid_share_path", codes)

    def test_warns_for_separate_mount_points_on_same_device(self):
        assessment = hlo.assess_mount_layout(
            "/mnt/src/movies/movie.mkv",
            "/mnt/dst/movies",
            source_device=22,
            dest_device=22,
            mountinfo_text=(
                "31 1 8:3 / /mnt/src rw,relatime - xfs /dev/sdb1 rw\n"
                "32 1 8:3 / /mnt/dst rw,relatime - xfs /dev/sdb1 rw\n"
            ),
        )
        codes = {warning.code for warning in assessment.warnings}
        self.assertIn("separate_mount_points", codes)

    def test_shared_disk_parent_layout_has_no_warnings(self):
        assessment = hlo.assess_mount_layout(
            "/mnt/disk3/ingress/movie.mkv",
            "/mnt/disk3/media",
            source_device=33,
            dest_device=33,
            mountinfo_text=(
                "41 1 8:3 / /mnt/disk3 rw,relatime - xfs /dev/sdb1 rw\n"
            ),
        )
        self.assertEqual(assessment.warnings, ())


# ---------------------------------------------------------------------------
# Hardlink execution tests (integration — same filesystem)
# ---------------------------------------------------------------------------

class TestHardlinkFile(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_hardlink_file_creates_link(self):
        src = self.root / "src" / "movie.mkv"
        _write_file(src, "fake movie content")
        dst = self.root / "dst" / "movie.mkv"
        result = hlo.LinkResult()
        hlo.hardlink_file(src, dst, result)
        self.assertTrue(dst.exists())
        self.assertEqual(len(result.linked), 1)
        self.assertEqual(len(result.failed), 0)

    def test_hardlink_file_same_inode(self):
        src = self.root / "src" / "movie.mkv"
        _write_file(src, "content")
        dst = self.root / "dst" / "movie.mkv"
        result = hlo.LinkResult()
        hlo.hardlink_file(src, dst, result)
        # True hardlink shares inode
        self.assertEqual(os.stat(src).st_ino, os.stat(dst).st_ino)

    def test_hardlink_file_skip_existing(self):
        src = self.root / "src" / "movie.mkv"
        _write_file(src, "original")
        dst = self.root / "dst" / "movie.mkv"
        _write_file(dst, "existing")
        result = hlo.LinkResult()
        hlo.hardlink_file(src, dst, result)
        self.assertEqual(len(result.skipped), 1)
        self.assertEqual(len(result.linked), 0)
        # Existing file must NOT be overwritten
        self.assertEqual(dst.read_text(), "existing")

    def test_dry_run_does_not_create_file(self):
        src = self.root / "src" / "movie.mkv"
        _write_file(src, "content")
        dst = self.root / "dst" / "movie.mkv"
        result = hlo.LinkResult()
        hlo.hardlink_file(src, dst, result, dry_run=True)
        self.assertFalse(dst.exists())
        self.assertEqual(len(result.linked), 1)  # counted as would-be link


class TestHardlinkTree(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def _build_source_tree(self) -> Path:
        src = self.root / "Show.S01"
        (src / "Episode01").mkdir(parents=True)
        _write_file(src / "Episode01" / "ep01.mkv", "ep1")
        _write_file(src / "Episode01" / "ep01.srt", "sub1")
        (src / "Episode02").mkdir()
        _write_file(src / "Episode02" / "ep02.mkv", "ep2")
        _write_file(src / "show.nfo", "nfo")
        return src

    def test_hardlink_tree_creates_all_files(self):
        src = self._build_source_tree()
        dst = self.root / "dest" / "Show S01"
        result = hlo.LinkResult()
        hlo.hardlink_tree(src, dst, result)
        self.assertTrue((dst / "Episode01" / "ep01.mkv").exists())
        self.assertTrue((dst / "Episode01" / "ep01.srt").exists())
        self.assertTrue((dst / "Episode02" / "ep02.mkv").exists())
        self.assertTrue((dst / "show.nfo").exists())

    def test_hardlink_tree_source_unchanged(self):
        src = self._build_source_tree()
        dst = self.root / "dest" / "Show S01"
        result = hlo.LinkResult()
        hlo.hardlink_tree(src, dst, result)
        # Source files must still exist
        self.assertTrue((src / "Episode01" / "ep01.mkv").exists())

    def test_hardlink_tree_collision_skipped(self):
        src = self._build_source_tree()
        dst = self.root / "dest" / "Show S01"
        # Pre-create one destination file
        (dst / "Episode01").mkdir(parents=True)
        _write_file(dst / "Episode01" / "ep01.mkv", "existing")
        result = hlo.LinkResult()
        hlo.hardlink_tree(src, dst, result)
        self.assertGreater(len(result.skipped), 0)
        # Existing file must not be overwritten
        self.assertEqual((dst / "Episode01" / "ep01.mkv").read_text(), "existing")

    def test_hardlink_tree_dry_run(self):
        src = self._build_source_tree()
        dst = self.root / "dest_dry" / "Show S01"
        result = hlo.LinkResult()
        hlo.hardlink_tree(src, dst, result, dry_run=True)
        # Nothing should actually be created
        self.assertFalse(dst.exists())
        self.assertGreater(len(result.linked), 0)

    def test_hardlink_tree_counts(self):
        src = self._build_source_tree()
        dst = self.root / "dest" / "Show S01"
        result = hlo.LinkResult()
        hlo.hardlink_tree(src, dst, result)
        # ep01.mkv, ep01.srt, ep02.mkv, show.nfo = 4 files
        self.assertEqual(len(result.linked), 4)

    def test_hardlink_tree_shares_inodes(self):
        src = self._build_source_tree()
        dst = self.root / "dest" / "Show S01"
        result = hlo.LinkResult()
        hlo.hardlink_tree(src, dst, result)
        src_ino = os.stat(src / "show.nfo").st_ino
        dst_ino = os.stat(dst / "show.nfo").st_ino
        self.assertEqual(src_ino, dst_ino)


# ---------------------------------------------------------------------------
# list_entries filter tests
# ---------------------------------------------------------------------------

class TestListEntries(unittest.TestCase):

    def _fake_entry(self, id_: int, source_set: str) -> hlo.InventoryEntry:
        return {
            "id": id_, "source_set": source_set, "entry_type": "file",
            "display_name": "Fake", "real_name": "fake.mkv",
            "full_path": "/fake/fake.mkv", "scan_time": "t",
            "size_bytes": 0, "device_id": 0,
        }

    def test_filter_by_set(self):
        entries = [self._fake_entry(1, "movies"), self._fake_entry(2, "shows")]
        result = hlo.list_entries(entries, "movies")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["source_set"], "movies")

    def test_no_filter_returns_all(self):
        entries = [self._fake_entry(1, "movies"), self._fake_entry(2, "shows")]
        result = hlo.list_entries(entries, None)
        self.assertEqual(len(result), 2)


# ---------------------------------------------------------------------------
# Main – allow running this file directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
