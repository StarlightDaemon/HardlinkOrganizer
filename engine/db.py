"""
Database layer for Hardlink Organizer.

Uses stdlib sqlite3 — no extra dependencies. Stores:
  - scans               : history of scan operations per source set
  - inventory           : latest inventory snapshot per scan
  - link_history        : every link operation ever executed (incl. dry-runs)
  - verification_runs   : one row per verification attempt
  - verification_results: per-file result for every verification run

Uses a single shared connection with a threading.RLock so the same instance
can be safely shared across all threads (FastAPI route handlers, TestClient, etc.)
without leaving orphaned connections that block temp-dir cleanup on Windows.
"""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path


_SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_set  TEXT    NOT NULL,
    scan_time   TEXT    NOT NULL,
    entry_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id      INTEGER NOT NULL REFERENCES scans(id),
    source_set   TEXT    NOT NULL,
    entry_type   TEXT    NOT NULL,
    display_name TEXT    NOT NULL,
    real_name    TEXT    NOT NULL,
    full_path    TEXT    NOT NULL,
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    device_id    INTEGER NOT NULL DEFAULT 0,
    scan_time    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS link_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_set    TEXT    NOT NULL,
    real_name     TEXT    NOT NULL,
    full_path     TEXT    NOT NULL,
    dest_set      TEXT    NOT NULL,
    dest_root     TEXT    NOT NULL,
    dest_subpath  TEXT    NOT NULL,
    dest_full     TEXT    NOT NULL,
    linked_count  INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count  INTEGER NOT NULL DEFAULT 0,
    dry_run       INTEGER NOT NULL DEFAULT 0,
    linked_at     TEXT    NOT NULL,
    notes         TEXT
);

CREATE TABLE IF NOT EXISTS verification_runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at       TEXT    NOT NULL,
    mode             TEXT    NOT NULL DEFAULT 'link_history',
    source_set       TEXT,
    dest_set         TEXT,
    link_history_id  INTEGER REFERENCES link_history(id),
    verified_count   INTEGER NOT NULL DEFAULT 0,
    failed_count     INTEGER NOT NULL DEFAULT 0,
    missing_count    INTEGER NOT NULL DEFAULT 0,
    error_count      INTEGER NOT NULL DEFAULT 0,
    notes            TEXT
);

CREATE TABLE IF NOT EXISTS verification_results (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           INTEGER NOT NULL REFERENCES verification_runs(id),
    source_path      TEXT    NOT NULL,
    candidate_dest   TEXT    NOT NULL,
    source_dev       INTEGER,
    source_inode     INTEGER,
    source_nlink     INTEGER,
    dest_dev         INTEGER,
    dest_inode       INTEGER,
    dest_nlink       INTEGER,
    status           TEXT    NOT NULL,
    notes            TEXT
);

CREATE TABLE IF NOT EXISTS destinations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    label      TEXT    NOT NULL,
    path       TEXT    NOT NULL UNIQUE,
    tag        TEXT,
    enabled    INTEGER NOT NULL DEFAULT 1,
    notes      TEXT,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
);
"""


class Database:
    """
    SQLite wrapper for hardlink organizer persistent state.

    Uses a single shared connection with check_same_thread=False and a
    threading.RLock so the instance can be safely shared across the FastAPI
    server's worker threads without leaving orphaned per-thread connections.
    """

    def __init__(self, db_path: str) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection: sqlite3.Connection | None = None
        self._connect()
        self._init_schema()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _connect(self) -> None:
        conn = sqlite3.connect(str(self._path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        self._connection = conn

    def _conn(self) -> sqlite3.Connection:
        """Return the shared connection, re-opening if close() was called."""
        with self._lock:
            if self._connection is None:
                self._connect()
            return self._connection  # type: ignore[return-value]

    def _init_schema(self) -> None:
        with self._lock:
            self._conn().executescript(_SCHEMA)
            self._conn().commit()

    def close(self) -> None:
        """Close the shared connection. Safe to call from any thread."""
        with self._lock:
            if self._connection is not None:
                try:
                    self._connection.close()
                except Exception:
                    pass
                self._connection = None

    # ------------------------------------------------------------------
    # Scan operations
    # ------------------------------------------------------------------

    def record_scan(self, source_set: str, scan_time: str, entries: list[dict]) -> int:
        """Persist a completed scan and its inventory entries. Returns scan_id."""
        with self._lock:
            conn = self._conn()
            cur = conn.execute(
                "INSERT INTO scans (source_set, scan_time, entry_count) VALUES (?, ?, ?)",
                (source_set, scan_time, len(entries)),
            )
            scan_id = cur.lastrowid
            conn.executemany(
                """INSERT INTO inventory
                   (scan_id, source_set, entry_type, display_name, real_name,
                    full_path, size_bytes, device_id, scan_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    (
                        scan_id,
                        e["source_set"],
                        e["entry_type"],
                        e["display_name"],
                        e["real_name"],
                        e["full_path"],
                        e.get("size_bytes", 0),
                        # Windows st_dev can be large unsigned; clamp to SQLite INT64
                        int(e.get("device_id", 0)) & 0x7FFFFFFFFFFFFFFF,
                        e.get("scan_time", scan_time),
                    )
                    for e in entries
                ],
            )
            conn.commit()
            return scan_id

    def get_latest_inventory(self, source_set: str) -> list[dict]:
        """Return inventory rows from the most recent scan of *source_set*."""
        with self._lock:
            conn = self._conn()
            row = conn.execute(
                "SELECT id FROM scans WHERE source_set = ? ORDER BY id DESC LIMIT 1",
                (source_set,),
            ).fetchone()
            if not row:
                return []
            scan_id = row["id"]
            rows = conn.execute(
                """SELECT * FROM inventory WHERE scan_id = ?
                   ORDER BY entry_type ASC, real_name COLLATE NOCASE""",
                (scan_id,),
            ).fetchall()
        result = []
        for idx, r in enumerate(rows, start=1):
            d = dict(r)
            d["id"] = idx
            result.append(d)
        return result

    def get_last_scan_time(self, source_set: str) -> str | None:
        """Return the ISO timestamp of the most recent scan, or None."""
        with self._lock:
            row = self._conn().execute(
                "SELECT scan_time FROM scans WHERE source_set = ? ORDER BY id DESC LIMIT 1",
                (source_set,),
            ).fetchone()
        return row["scan_time"] if row else None

    def get_scan_summary(self, source_set: str) -> dict | None:
        """Return {scan_time, entry_count} for the latest scan of a set, or None."""
        with self._lock:
            row = self._conn().execute(
                "SELECT scan_time, entry_count FROM scans WHERE source_set = ? ORDER BY id DESC LIMIT 1",
                (source_set,),
            ).fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------
    # Link history
    # ------------------------------------------------------------------

    def record_link(
        self,
        source_set: str,
        real_name: str,
        full_path: str,
        dest_set: str,
        dest_root: str,
        dest_subpath: str,
        dest_full: str,
        linked_count: int,
        skipped_count: int,
        failed_count: int,
        dry_run: bool,
        linked_at: str,
        notes: str | None = None,
    ) -> int:
        """Record a link operation and return its history id."""
        with self._lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO link_history
                   (source_set, real_name, full_path, dest_set, dest_root,
                    dest_subpath, dest_full, linked_count, skipped_count,
                    failed_count, dry_run, linked_at, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    source_set, real_name, full_path, dest_set, dest_root,
                    dest_subpath, dest_full, linked_count, skipped_count,
                    failed_count, int(dry_run), linked_at, notes,
                ),
            )
            conn.commit()
            return cur.lastrowid

    def get_history(self, limit: int = 50, source_set: str | None = None) -> list[dict]:
        """Return recent link history records, newest first."""
        with self._lock:
            conn = self._conn()
            if source_set:
                rows = conn.execute(
                    "SELECT * FROM link_history WHERE source_set = ? ORDER BY id DESC LIMIT ?",
                    (source_set, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM link_history ORDER BY id DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [dict(r) for r in rows]

    def get_link_history_record(self, history_id: int) -> dict | None:
        """Return a single link history record by id, or None if not found."""
        with self._lock:
            row = self._conn().execute(
                "SELECT * FROM link_history WHERE id = ?",
                (history_id,),
            ).fetchone()
        return dict(row) if row else None

    def is_linked(self, full_path: str) -> bool:
        """Return True if this source path has any successful real (non-dry-run) link record."""
        with self._lock:
            row = self._conn().execute(
                """SELECT 1 FROM link_history
                   WHERE full_path = ? AND dry_run = 0 AND linked_count > 0
                   LIMIT 1""",
                (full_path,),
            ).fetchone()
        return row is not None

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

    # ------------------------------------------------------------------
    # Verification runs
    # ------------------------------------------------------------------

    def create_verification_run(
        self,
        created_at: str,
        mode: str = "link_history",
        source_set: str | None = None,
        dest_set: str | None = None,
        link_history_id: int | None = None,
        notes: str | None = None,
    ) -> int:
        """Insert a new verification run row and return its id."""
        with self._lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO verification_runs
                   (created_at, mode, source_set, dest_set, link_history_id, notes)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (created_at, mode, source_set, dest_set, link_history_id, notes),
            )
            conn.commit()
            return cur.lastrowid

    def update_verification_run_summary(
        self,
        run_id: int,
        verified_count: int,
        failed_count: int,
        missing_count: int,
        error_count: int,
    ) -> None:
        """Update aggregate counts on a verification run row."""
        with self._lock:
            conn = self._conn()
            conn.execute(
                """UPDATE verification_runs
                   SET verified_count = ?,
                       failed_count   = ?,
                       missing_count  = ?,
                       error_count    = ?
                   WHERE id = ?""",
                (verified_count, failed_count, missing_count, error_count, run_id),
            )
            conn.commit()

    def record_verification_result(
        self,
        run_id: int,
        source_path: str,
        candidate_dest: str,
        source_dev: int | None,
        source_inode: int | None,
        source_nlink: int | None,
        dest_dev: int | None,
        dest_inode: int | None,
        dest_nlink: int | None,
        status: str,
        notes: str | None = None,
    ) -> int:
        """Insert one per-file verification result and return its id.

        st_dev and st_ino from Windows can be large unsigned integers that
        exceed SQLite's signed INT64 range.  We clamp them the same way the
        inventory insert clamps device_id.
        """
        def _clamp(v: int | None) -> int | None:
            return (int(v) & 0x7FFFFFFFFFFFFFFF) if v is not None else None

        with self._lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO verification_results
                   (run_id, source_path, candidate_dest,
                    source_dev, source_inode, source_nlink,
                    dest_dev, dest_inode, dest_nlink,
                    status, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    run_id, source_path, candidate_dest,
                    _clamp(source_dev), _clamp(source_inode), source_nlink,
                    _clamp(dest_dev), _clamp(dest_inode), dest_nlink,
                    status, notes,
                ),
            )
            conn.commit()
            return cur.lastrowid

    def get_verification_run(self, run_id: int) -> dict | None:
        """Return the verification run row + its result rows, or None if not found."""
        with self._lock:
            conn = self._conn()
            run_row = conn.execute(
                "SELECT * FROM verification_runs WHERE id = ?", (run_id,)
            ).fetchone()
            if not run_row:
                return None
            result_rows = conn.execute(
                "SELECT * FROM verification_results WHERE run_id = ? ORDER BY id",
                (run_id,),
            ).fetchall()
        run = dict(run_row)
        run["results"] = [dict(r) for r in result_rows]
        return run

    # ------------------------------------------------------------------
    # Destination registry
    # ------------------------------------------------------------------

    def add_destination(
        self,
        label: str,
        path: str,
        tag: str | None,
        enabled: bool,
        notes: str | None,
        created_at: str,
        updated_at: str,
    ) -> int:
        """Insert a managed destination and return its id."""
        with self._lock:
            conn = self._conn()
            cur = conn.execute(
                """INSERT INTO destinations
                   (label, path, tag, enabled, notes, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (label, path, tag, int(enabled), notes, created_at, updated_at),
            )
            conn.commit()
            return cur.lastrowid

    def list_destinations(self) -> list[dict]:
        """Return all managed destinations ordered by id."""
        with self._lock:
            rows = self._conn().execute(
                "SELECT * FROM destinations ORDER BY id"
            ).fetchall()
        return [dict(r) for r in rows]

    def get_destination(self, dest_id: int) -> dict | None:
        """Return a single destination row by id, or None if not found."""
        with self._lock:
            row = self._conn().execute(
                "SELECT * FROM destinations WHERE id = ?", (dest_id,)
            ).fetchone()
        return dict(row) if row else None

    def update_destination(self, dest_id: int, **fields) -> bool:
        """Patch one or more fields on a destination row. Returns True if a row was updated."""
        _allowed = {"label", "path", "tag", "enabled", "notes", "updated_at"}
        updates: dict = {k: v for k, v in fields.items() if k in _allowed}
        if "enabled" in updates:
            updates["enabled"] = int(updates["enabled"])
        if not updates:
            return False
        cols = ", ".join(f"{k} = ?" for k in updates)
        vals = list(updates.values()) + [dest_id]
        with self._lock:
            conn = self._conn()
            cur = conn.execute(
                f"UPDATE destinations SET {cols} WHERE id = ?", vals
            )
            conn.commit()
        return cur.rowcount > 0

    def delete_destination(self, dest_id: int) -> bool:
        """Delete a destination row. Returns True if a row was deleted."""
        with self._lock:
            conn = self._conn()
            cur = conn.execute("DELETE FROM destinations WHERE id = ?", (dest_id,))
            conn.commit()
        return cur.rowcount > 0
