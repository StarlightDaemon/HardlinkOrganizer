"""
Integration tests for the Hardlink Organizer web API.

This suite intentionally avoids FastAPI's TestClient. In the current dependency
stack available in this workspace, even a one-route FastAPI app hangs under
TestClient requests, which makes the app behavior impossible to validate
reliably. These tests invoke routed endpoint functions directly through a small
request harness instead.
"""
from __future__ import annotations

import asyncio
import inspect
import json
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path
from typing import get_type_hints
from urllib.parse import parse_qs, urlsplit

_TOOL_DIR = Path(__file__).resolve().parent.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

import hardlink_organizer as hlo  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.encoders import jsonable_encoder  # noqa: E402
from pydantic import BaseModel, ValidationError  # noqa: E402
from starlette.requests import Request  # noqa: E402
from starlette.responses import Response  # noqa: E402
from starlette.routing import Match  # noqa: E402


def _write_file(path: Path, content: str = "data") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _make_cfg(src_root: str, dst_root: str, db_path: str) -> dict:
    return {
        "paths": {
            "index_json": str(Path(src_root).parent / "index.json"),
            "index_tsv":  str(Path(src_root).parent / "index.tsv"),
            "log_file":   None,
            "db_file":    db_path,
        },
        "settings": {"include_hidden": False, "collision_policy": "skip"},
        "source_sets": {"movies": src_root},
        "dest_sets":   {"movies": dst_root},
    }


class _TestResponse:
    def __init__(self, status_code: int, headers: dict[str, str], content: str | bytes):
        self.status_code = status_code
        self.headers = {str(k).lower(): str(v) for k, v in headers.items()}
        if isinstance(content, bytes):
            self.content = content
            self.text = content.decode("utf-8")
        else:
            self.text = content
            self.content = content.encode("utf-8")

    def json(self):
        return json.loads(self.text)


class _RouteHarnessClient:
    """Small route-invocation harness for FastAPI endpoints."""

    def __init__(self, app):
        self.app = app

    def get(self, url: str):
        return self._request("GET", url)

    def post(self, url: str, json: dict | None = None):
        return self._request("POST", url, json_body=json)

    def _request(self, method: str, url: str, json_body: dict | None = None):
        split = urlsplit(url)
        path = split.path
        query = {
            key: values[-1]
            for key, values in parse_qs(split.query, keep_blank_values=True).items()
        }
        scope = {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "path": path,
            "raw_path": path.encode("utf-8"),
            "query_string": split.query.encode("utf-8"),
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
            "scheme": "http",
            "app": self.app,
        }

        target = None
        path_params: dict[str, str] = {}
        for route in self.app.router.routes:
            match, child_scope = route.matches(scope)
            if match == Match.FULL:
                target = route
                path_params = child_scope.get("path_params", {})
                scope.update(child_scope)
                break

        if target is None:
            raise AssertionError(f"No route found for {method} {url}")

        request = Request(scope)
        endpoint = target.endpoint
        kwargs = {}
        type_hints = get_type_hints(endpoint)

        try:
            sig = inspect.signature(endpoint)
            for name, param in sig.parameters.items():
                ann = type_hints.get(name, param.annotation)
                if name == "request" or ann is Request:
                    kwargs[name] = request
                    continue

                if name in path_params:
                    kwargs[name] = self._convert_value(path_params[name], ann)
                    continue

                if json_body is not None and self._is_pydantic_model(ann):
                    kwargs[name] = ann(**json_body)
                    continue

                if name in query:
                    kwargs[name] = self._convert_value(query[name], ann)
                    continue

                if param.default is inspect._empty:
                    return self._validation_error(f"Missing required parameter: {name}")
        except ValidationError as exc:
            return self._validation_error(str(exc))

        try:
            if inspect.iscoroutinefunction(endpoint):
                result = asyncio.run(endpoint(**kwargs))
            else:
                result = endpoint(**kwargs)
        except HTTPException as exc:
            return _TestResponse(
                exc.status_code,
                {"content-type": "application/json"},
                json.dumps({"detail": exc.detail}),
            )

        if isinstance(result, Response):
            body = result.body
            return _TestResponse(result.status_code, dict(result.headers), body)

        payload = jsonable_encoder(result)
        return _TestResponse(
            200,
            {"content-type": "application/json"},
            json.dumps(payload),
        )

    @staticmethod
    def _is_pydantic_model(annotation) -> bool:
        return inspect.isclass(annotation) and issubclass(annotation, BaseModel)

    @staticmethod
    def _convert_value(value: str, annotation):
        if annotation is bool:
            return value.lower() in {"1", "true", "yes", "on"}
        if annotation is int:
            return int(value)
        return value

    @staticmethod
    def _validation_error(detail: str):
        return _TestResponse(
            422,
            {"content-type": "application/json"},
            json.dumps({"detail": detail}),
        )


class TestWebApp(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        try:
            from engine.db import Database
            from webapp.app import create_app
            cls._skip = False
            cls._Database    = Database
            cls._create_app  = staticmethod(create_app)
        except ImportError as exc:
            cls._skip = True
            cls._skip_reason = str(exc)

    def setUp(self):
        if self._skip:
            self.skipTest(f"Skipping webapp tests — missing dependency: {self._skip_reason}")

        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.src_root = str(root / "src")
        self.dst_root = str(root / "dst")
        Path(self.src_root).mkdir()
        Path(self.dst_root).mkdir()

        # Build a small source tree
        _write_file(Path(self.src_root) / "Blade.Runner.1982.mkv", "content1")
        _write_file(Path(self.src_root) / "The.Dark.Knight.2008.mkv", "content2")
        (Path(self.src_root) / "Show.S01").mkdir()
        _write_file(Path(self.src_root) / "Show.S01" / "ep01.mkv", "ep1")

        db_path = str(root / "test.db")
        cfg = _make_cfg(self.src_root, self.dst_root, db_path)
        db = self._Database(db_path)
        self.db = db

        app = self._create_app(cfg, db, "test-config.toml")
        self.client = _RouteHarnessClient(app)

    def tearDown(self):
        if hasattr(self, 'db') and self.db:
            self.db.close()
        self.tmp.cleanup()

    # -----------------------------------------------------------------------
    # Health
    # -----------------------------------------------------------------------

    def test_health_ok(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["config_loaded"])

    def test_health_version(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("version", data)
        self.assertTrue(data["version"].startswith("0."))

    # -----------------------------------------------------------------------
    # Config / Sets
    # -----------------------------------------------------------------------

    def test_get_sets_returns_source_and_dest(self):
        res = self.client.get("/api/config/sets")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("movies", data["source_sets"])
        self.assertIn("movies", data["dest_sets"])

    def test_get_sets_scan_summaries_present(self):
        res = self.client.get("/api/config/sets")
        data = res.json()
        self.assertIn("scan_summaries", data)
        self.assertIn("movies", data["scan_summaries"])

    # -----------------------------------------------------------------------
    # Scan
    # -----------------------------------------------------------------------

    def test_scan_all_sets(self):
        res = self.client.post("/api/scan", json={})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("movies", data["scanned_sets"])
        self.assertEqual(data["per_set"]["movies"], 3)  # 2 files + 1 dir

    def test_scan_single_set(self):
        res = self.client.post("/api/scan", json={"source_set": "movies"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["scanned_sets"], ["movies"])

    def test_scan_unknown_set_returns_404(self):
        res = self.client.post("/api/scan", json={"source_set": "no_such_set"})
        self.assertEqual(res.status_code, 404)

    # -----------------------------------------------------------------------
    # Inventory
    # -----------------------------------------------------------------------

    def test_inventory_requires_source_set(self):
        res = self.client.get("/api/inventory")    # missing param
        self.assertEqual(res.status_code, 422)

    def test_inventory_unknown_set_404(self):
        res = self.client.get("/api/inventory?source_set=unknown")
        self.assertEqual(res.status_code, 404)

    def test_inventory_live_scan(self):
        res = self.client.get("/api/inventory?source_set=movies&live=true")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["source_set"], "movies")
        self.assertEqual(len(data["entries"]), 3)

    def test_inventory_from_db_after_scan(self):
        self.client.post("/api/scan", json={"source_set": "movies"})
        res = self.client.get("/api/inventory?source_set=movies")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["from_db"])
        self.assertEqual(len(data["entries"]), 3)

    def test_inventory_entries_have_linked_field(self):
        self.client.post("/api/scan", json={"source_set": "movies"})
        res = self.client.get("/api/inventory?source_set=movies")
        data = res.json()
        for entry in data["entries"]:
            self.assertIn("linked", entry)
            self.assertIsInstance(entry["linked"], bool)

    def test_inventory_dirs_come_before_files(self):
        self.client.post("/api/scan", json={"source_set": "movies"})
        res = self.client.get("/api/inventory?source_set=movies")
        data = res.json()
        types = [e["entry_type"] for e in data["entries"]]
        # dirs should appear first
        dir_indices = [i for i, t in enumerate(types) if t == "dir"]
        file_indices = [i for i, t in enumerate(types) if t == "file"]
        if dir_indices and file_indices:
            self.assertLess(max(dir_indices), min(file_indices))

    # -----------------------------------------------------------------------
    # Preview
    # -----------------------------------------------------------------------

    def _scan_and_get_entry_id(self) -> int:
        self.client.post("/api/scan", json={"source_set": "movies"})
        inv = self.client.get("/api/inventory?source_set=movies").json()
        # Pick a file entry
        file_entries = [e for e in inv["entries"] if e["entry_type"] == "file"]
        return file_entries[0]["id"]

    def test_preview_returns_plan(self):
        entry_id = self._scan_and_get_entry_id()
        res = self.client.post("/api/preview", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("source_path", data)
        self.assertIn("dest_full", data)
        self.assertIn("valid", data)

    def test_preview_valid_for_same_device(self):
        entry_id = self._scan_and_get_entry_id()
        res = self.client.post("/api/preview", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
        })
        data = res.json()
        self.assertTrue(data["valid"])
        self.assertEqual(data["errors"], [])

    def test_preview_custom_subpath(self):
        entry_id = self._scan_and_get_entry_id()
        res = self.client.post("/api/preview", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
            "dest_subpath": "My Custom Folder",
        })
        data = res.json()
        self.assertEqual(data["dest_subpath"], "My Custom Folder")

    def test_preview_returns_mount_layout_warnings(self):
        entry_id = self._scan_and_get_entry_id()
        assessment = hlo.MountLayoutAssessment(
            same_device=True,
            source_mount_point="/mnt/src",
            dest_mount_point="/mnt/dst",
            warnings=(
                hlo.MountLayoutWarning(
                    code="separate_mount_points",
                    title="Separate container mounts may still fail with EXDEV",
                    detail="Preview can still diverge from execution on Unraid.",
                    recommendation="Use one shared parent mount.",
                ),
            ),
        )

        with mock.patch("hardlink_organizer.assess_mount_layout", return_value=assessment):
            res = self.client.post("/api/preview", json={
                "source_set": "movies",
                "entry_id": entry_id,
                "dest_set": "movies",
            })

        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["warnings"][0]["code"], "separate_mount_points")
        self.assertIn("shared parent mount", data["warnings"][0]["recommendation"])

    def test_preview_unknown_set_404(self):
        res = self.client.post("/api/preview", json={
            "source_set": "no_such",
            "entry_id": 1,
            "dest_set": "movies",
        })
        self.assertEqual(res.status_code, 404)

    # -----------------------------------------------------------------------
    # Execute (dry run)
    # -----------------------------------------------------------------------

    def _get_entry_id_and_subpath(self) -> tuple[int, str]:
        entry_id = self._scan_and_get_entry_id()
        inv = self.client.get("/api/inventory?source_set=movies").json()
        entry = next(e for e in inv["entries"] if e["id"] == entry_id)
        return entry_id, entry["display_name"]

    def test_execute_dry_run_no_files_created(self):
        entry_id, subpath = self._get_entry_id_and_subpath()
        res = self.client.post("/api/execute", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
            "dest_subpath": subpath,
            "dry_run": True,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["dry_run"])
        # No actual files created
        self.assertFalse((Path(self.dst_root) / subpath).exists())

    def test_execute_dry_run_counts_files(self):
        entry_id, subpath = self._get_entry_id_and_subpath()
        res = self.client.post("/api/execute", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
            "dest_subpath": subpath,
            "dry_run": True,
        })
        data = res.json()
        self.assertGreater(data["linked"], 0)

    def test_execute_real_creates_hardlink(self):
        entry_id, subpath = self._get_entry_id_and_subpath()
        res = self.client.post("/api/execute", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
            "dest_subpath": subpath,
            "dry_run": False,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertGreater(data["linked"], 0)
        self.assertIsNotNone(data["history_id"])

    def test_execute_records_history(self):
        entry_id, subpath = self._get_entry_id_and_subpath()
        self.client.post("/api/execute", json={
            "source_set": "movies",
            "entry_id": entry_id,
            "dest_set": "movies",
            "dest_subpath": subpath,
            "dry_run": False,
        })
        hist = self.client.get("/api/history").json()
        self.assertGreater(hist["total"], 0)
        self.assertEqual(hist["history"][0]["source_set"], "movies")

    # -----------------------------------------------------------------------
    # History
    # -----------------------------------------------------------------------

    def test_history_empty_initially(self):
        res = self.client.get("/api/history")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 0)

    def test_history_filter_by_source_set(self):
        # No entries yet — expect empty
        res = self.client.get("/api/history?source_set=movies")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["total"], 0)

    # -----------------------------------------------------------------------
    # UI route
    # -----------------------------------------------------------------------

    def test_index_returns_html(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/html", res.headers.get("content-type", ""))

    def test_index_contains_version(self):
        res = self.client.get("/")
        self.assertIn("0.", res.text)   # version string appears somewhere


class TestVerifyAPI(unittest.TestCase):
    """Tests for POST /api/verify and GET /api/verify/{run_id}."""

    @classmethod
    def setUpClass(cls):
        try:
            from engine.db import Database
            from webapp.app import create_app
            cls._skip = False
            cls._Database = Database
            cls._create_app = staticmethod(create_app)
        except ImportError as exc:
            cls._skip = True
            cls._skip_reason = str(exc)

    def setUp(self):
        if self._skip:
            self.skipTest(f"Skipping webapp tests — missing dependency: {self._skip_reason}")

        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.src_root = str(root / "src")
        self.dst_root = str(root / "dst")
        Path(self.src_root).mkdir()
        Path(self.dst_root).mkdir()

        # Write a source file and create a hardlink at destination
        src_file = Path(self.src_root) / "movie.mkv"
        _write_file(src_file, "content")
        dst_file = Path(self.dst_root) / "movie.mkv"
        import os as _os
        _os.link(str(src_file), str(dst_file))

        db_path = str(root / "test.db")
        cfg = _make_cfg(self.src_root, self.dst_root, db_path)
        db = self._Database(db_path)
        self.db = db

        # Seed one real link history record referencing the source file
        import time as _time
        self._history_id = db.record_link(
            source_set="movies",
            real_name="movie.mkv",
            full_path=str(src_file),
            dest_set="movies",
            dest_root=self.dst_root,
            dest_subpath="movie.mkv",
            dest_full=str(dst_file),
            linked_count=1,
            skipped_count=0,
            failed_count=0,
            dry_run=False,
            linked_at=_time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        )

        app = self._create_app(cfg, db, "test-config.toml")
        self.client = _RouteHarnessClient(app)

    def tearDown(self):
        if hasattr(self, "db") and self.db:
            self.db.close()
        self.tmp.cleanup()

    # -----------------------------------------------------------------------
    # POST /api/verify
    # -----------------------------------------------------------------------

    def test_post_verify_returns_run_id(self):
        res = self.client.post("/api/verify", json={
            "mode": "link_history",
            "link_history_id": self._history_id,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("run_id", data)
        self.assertIsInstance(data["run_id"], int)
        self.assertGreater(data["run_id"], 0)

    def test_post_verify_unknown_history_returns_404(self):
        res = self.client.post("/api/verify", json={
            "mode": "link_history",
            "link_history_id": 999999,
        })
        self.assertEqual(res.status_code, 404)

    def test_post_verify_wrong_mode_returns_422(self):
        res = self.client.post("/api/verify", json={
            "mode": "set_pair",
            "link_history_id": self._history_id,
        })
        self.assertEqual(res.status_code, 422)

    # -----------------------------------------------------------------------
    # GET /api/verify/{run_id}
    # -----------------------------------------------------------------------

    def _create_run(self) -> int:
        res = self.client.post("/api/verify", json={
            "mode": "link_history",
            "link_history_id": self._history_id,
        })
        return res.json()["run_id"]

    def test_get_verify_run_returns_results(self):
        run_id = self._create_run()
        res = self.client.get(f"/api/verify/{run_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["run_id"], run_id)
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)
        self.assertGreater(len(data["results"]), 0)

    def test_get_verify_run_has_correct_counts(self):
        run_id = self._create_run()
        res = self.client.get(f"/api/verify/{run_id}")
        data = res.json()
        # source file is hardlinked, so verified_count should be 1
        self.assertEqual(data["verified_count"], 1)
        self.assertEqual(data["missing_count"], 0)

    def test_get_verify_run_result_has_required_fields(self):
        run_id = self._create_run()
        res = self.client.get(f"/api/verify/{run_id}")
        data = res.json()
        r = data["results"][0]
        for field in ("id", "source_path", "candidate_dest", "status"):
            self.assertIn(field, r)

    def test_get_verify_run_result_status_is_verified_hardlinked(self):
        run_id = self._create_run()
        res = self.client.get(f"/api/verify/{run_id}")
        data = res.json()
        statuses = {r["status"] for r in data["results"]}
        self.assertIn("verified_hardlinked", statuses)

    def test_get_verify_unknown_run_returns_404(self):
        res = self.client.get("/api/verify/999999")
        self.assertEqual(res.status_code, 404)

    # -----------------------------------------------------------------------
    # Export endpoints
    # -----------------------------------------------------------------------

    def test_get_verify_export_json_returns_data(self):
        run_id = self._create_run()
        res = self.client.get(f"/api/verify/{run_id}/export.json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["id"], run_id)
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)

    def test_get_verify_export_json_unknown_returns_404(self):
        res = self.client.get("/api/verify/999999/export.json")
        self.assertEqual(res.status_code, 404)

    def test_get_verify_export_csv_returns_csv_data(self):
        run_id = self._create_run()
        res = self.client.get(f"/api/verify/{run_id}/export.csv")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "text/csv; charset=utf-8")
        self.assertIn("attachment", res.headers["content-disposition"])
        
        text = res.text
        lines = text.strip().split("\n")
        self.assertGreater(len(lines), 1)  # header + at least one row
        self.assertTrue(lines[0].startswith("status,notes,source_path"))
        
        # Check that we have a verified_hardlinked row
        self.assertTrue(any("verified_hardlinked" in line for line in lines))

    def test_get_verify_export_csv_unknown_returns_404(self):
        res = self.client.get("/api/verify/999999/export.csv")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
