"""
Verification engine for Hardlink Organizer.

Supports verifying whether files recorded in a link_history row are truly
hardlinked at the expected destination paths.

Design rules:
  - inode + device match is the only accepted proof of a hardlink
  - filename matching is NOT treated as proof
  - symlinks at the destination are flagged, not treated as hardlinks
  - cross-filesystem pairs are flagged before inode comparison
  - all results are persisted; nothing is derived on-the-fly

Statuses emitted:
  verified_hardlinked          source and destination share st_dev + st_ino
  exists_but_not_hardlinked    destination exists but inode or device differs
  missing_at_destination       destination path does not exist
  cannot_verify_symlink        destination is a symlink (not a regular hardlink)
  cannot_verify_permission_error  os.stat raised PermissionError
  cannot_verify_cross_filesystem  source and destination are on different devices
                                  discovered before inode comparison
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from engine.db import Database


# ---------------------------------------------------------------------------
# Public status constants
# ---------------------------------------------------------------------------

STATUS_VERIFIED_HARDLINKED = "verified_hardlinked"
STATUS_EXISTS_BUT_NOT_HARDLINKED = "exists_but_not_hardlinked"
STATUS_MISSING_AT_DESTINATION = "missing_at_destination"
STATUS_CANNOT_VERIFY_SYMLINK = "cannot_verify_symlink"
STATUS_CANNOT_VERIFY_PERMISSION_ERROR = "cannot_verify_permission_error"
STATUS_CANNOT_VERIFY_CROSS_FILESYSTEM = "cannot_verify_cross_filesystem"

ALL_STATUSES = frozenset(
    {
        STATUS_VERIFIED_HARDLINKED,
        STATUS_EXISTS_BUT_NOT_HARDLINKED,
        STATUS_MISSING_AT_DESTINATION,
        STATUS_CANNOT_VERIFY_SYMLINK,
        STATUS_CANNOT_VERIFY_PERMISSION_ERROR,
        STATUS_CANNOT_VERIFY_CROSS_FILESYSTEM,
    }
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _classify(
    source_path: str,
    dest_path: str,
) -> tuple[str, int | None, int | None, int | None, int | None, int | None, int | None, str | None]:
    """
    Stat source and destination, classify the relationship.

    Returns:
        status, src_dev, src_ino, src_nlink, dst_dev, dst_ino, dst_nlink, notes
    """
    # Stat the source (should always exist; flag as error if not)
    try:
        src_stat = os.stat(source_path)
    except PermissionError:
        return (
            STATUS_CANNOT_VERIFY_PERMISSION_ERROR,
            None, None, None, None, None, None,
            "PermissionError reading source",
        )
    except OSError as exc:
        return (
            STATUS_CANNOT_VERIFY_PERMISSION_ERROR,
            None, None, None, None, None, None,
            f"OSError reading source: {exc}",
        )

    src_dev = int(src_stat.st_dev) & 0x7FFFFFFFFFFFFFFF
    src_ino = int(src_stat.st_ino) & 0x7FFFFFFFFFFFFFFF
    src_nlink = src_stat.st_nlink

    # Check destination existence without following symlinks first
    dest = Path(dest_path)
    if not dest.exists() and not dest.is_symlink():
        return (
            STATUS_MISSING_AT_DESTINATION,
            src_dev, src_ino, src_nlink,
            None, None, None,
            None,
        )

    # Symlink check (lstat so we see the link itself, not its target)
    try:
        dst_lstat = os.lstat(dest_path)
    except PermissionError:
        return (
            STATUS_CANNOT_VERIFY_PERMISSION_ERROR,
            src_dev, src_ino, src_nlink,
            None, None, None,
            "PermissionError reading destination",
        )
    except OSError as exc:
        return (
            STATUS_CANNOT_VERIFY_PERMISSION_ERROR,
            src_dev, src_ino, src_nlink,
            None, None, None,
            f"OSError reading destination: {exc}",
        )

    import stat as _stat
    if _stat.S_ISLNK(dst_lstat.st_mode):
        return (
            STATUS_CANNOT_VERIFY_SYMLINK,
            src_dev, src_ino, src_nlink,
            dst_lstat.st_dev, dst_lstat.st_ino, dst_lstat.st_nlink,
            "Destination is a symlink, not a hardlink",
        )

    # Clamp Windows unsigned st_dev / st_ino to SQLite signed INT64 so that
    # the values we compare here match what gets stored in the database.
    _MASK = 0x7FFFFFFFFFFFFFFF

    dst_dev = int(dst_lstat.st_dev) & _MASK
    dst_ino = int(dst_lstat.st_ino) & _MASK
    dst_nlink = dst_lstat.st_nlink

    # Cross-filesystem check (before inode comparison — different devices
    # would never share an inode, so this gives a cleaner error category)
    if src_dev != dst_dev:
        return (
            STATUS_CANNOT_VERIFY_CROSS_FILESYSTEM,
            src_dev, src_ino, src_nlink,
            dst_dev, dst_ino, dst_nlink,
            "Source and destination are on different filesystems",
        )

    # Inode proof
    if src_ino == dst_ino:
        return (
            STATUS_VERIFIED_HARDLINKED,
            src_dev, src_ino, src_nlink,
            dst_dev, dst_ino, dst_nlink,
            None,
        )

    return (
        STATUS_EXISTS_BUT_NOT_HARDLINKED,
        src_dev, src_ino, src_nlink,
        dst_dev, dst_ino, dst_nlink,
        "Same filesystem but different inodes — file exists but is not hardlinked",
    )


def _iter_source_files(source_root: str):
    """
    Yield all regular files under *source_root*.

    If source_root is itself a regular file, yield it directly.
    Follows the same pattern as the existing engine: recurse, files only.
    """
    p = Path(source_root)
    if p.is_file():
        yield str(p)
        return
    for child in p.rglob("*"):
        if child.is_file() and not child.is_symlink():
            yield str(child)


def _derive_dest_path(source_file: str, source_root: str, dest_full: str) -> str:
    """
    Translate *source_file* to an expected destination path.

    Example:
        source_file  = /src/MovieA/disc1/a.mkv
        source_root  = /src/MovieA
        dest_full    = /dst/movies/Movie A (2020)
        → result     = /dst/movies/Movie A (2020)/disc1/a.mkv

    When source_root IS source_file (i.e. the job was a single file),
    the result is just dest_full + the filename.
    """
    src_path = Path(source_file)
    root_path = Path(source_root)

    if src_path == root_path:
        # Single-file job; dest_full is the destination file path directly
        return dest_full

    try:
        relative = src_path.relative_to(root_path)
    except ValueError:
        # Unexpected — fall back to appending the filename
        relative = Path(src_path.name)

    return str(Path(dest_full) / relative)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_verification_for_link_history(db: "Database", history_record: dict) -> int:
    """
    Verify all files from one link_history record and persist results.

    Parameters
    ----------
    db:             Initialised Database instance.
    history_record: A dict as returned by db.get_history() — must contain at
                    minimum: id, source_set, dest_set, full_path, dest_full.

    Returns
    -------
    run_id:  The newly created verification_runs row id.
    """
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    history_id = history_record["id"]
    source_set = history_record.get("source_set")
    dest_set = history_record.get("dest_set")
    source_root = history_record["full_path"]
    dest_full = history_record["dest_full"]

    run_id = db.create_verification_run(
        created_at=now,
        mode="link_history",
        source_set=source_set,
        dest_set=dest_set,
        link_history_id=history_id,
    )

    counts = {
        STATUS_VERIFIED_HARDLINKED: 0,
        STATUS_EXISTS_BUT_NOT_HARDLINKED: 0,
        STATUS_MISSING_AT_DESTINATION: 0,
        STATUS_CANNOT_VERIFY_PERMISSION_ERROR: 0,
        STATUS_CANNOT_VERIFY_SYMLINK: 0,
        STATUS_CANNOT_VERIFY_CROSS_FILESYSTEM: 0,
    }

    for source_file in _iter_source_files(source_root):
        candidate_dest = _derive_dest_path(source_file, source_root, dest_full)
        (
            status,
            src_dev, src_ino, src_nlink,
            dst_dev, dst_ino, dst_nlink,
            notes,
        ) = _classify(source_file, candidate_dest)

        db.record_verification_result(
            run_id=run_id,
            source_path=source_file,
            candidate_dest=candidate_dest,
            source_dev=src_dev,
            source_inode=src_ino,
            source_nlink=src_nlink,
            dest_dev=dst_dev,
            dest_inode=dst_ino,
            dest_nlink=dst_nlink,
            status=status,
            notes=notes,
        )
        counts[status] = counts.get(status, 0) + 1

    # Aggregate into the two summary buckets expected by the DB column names
    verified = counts[STATUS_VERIFIED_HARDLINKED]
    failed = counts[STATUS_EXISTS_BUT_NOT_HARDLINKED] + counts[STATUS_CANNOT_VERIFY_CROSS_FILESYSTEM]
    missing = counts[STATUS_MISSING_AT_DESTINATION]
    errors = (
        counts[STATUS_CANNOT_VERIFY_PERMISSION_ERROR]
        + counts[STATUS_CANNOT_VERIFY_SYMLINK]
    )

    db.update_verification_run_summary(
        run_id=run_id,
        verified_count=verified,
        failed_count=failed,
        missing_count=missing,
        error_count=errors,
    )

    return run_id
