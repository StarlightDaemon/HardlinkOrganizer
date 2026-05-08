#!/usr/bin/env python3
"""
Hardlink Organizer
======================
CLI tool for scanning configured ingress roots, building a structured inventory,
and safely hardlinking selected files or directory trees into destination library
roots without modifying the source payload.

Usage:
    python hardlink_organizer.py --config config.toml scan [--set <name>] [--json-out <path>] [--tsv-out <path>]
    python hardlink_organizer.py --config config.toml list <source_set>
    python hardlink_organizer.py --config config.toml link <source_set> <entry_id> <dest_set> [--dest-subpath <path>] [--dry-run]
    python hardlink_organizer.py --config config.toml interactive
    python hardlink_organizer.py --config config.toml validate <source_path> <dest_root>
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import TypedDict

__version__ = "0.3.0"

# ---------------------------------------------------------------------------
# Conditional import: tomllib is stdlib in Python 3.11+; fall back to tomli.
# ---------------------------------------------------------------------------
try:
    import tomllib  # type: ignore[import]
except ImportError:
    try:
        import tomli as tomllib  # type: ignore[import]
    except ImportError:
        tomllib = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Type definitions
# ---------------------------------------------------------------------------

class InventoryEntry(TypedDict):
    id: int
    source_set: str
    entry_type: str  # "file" or "dir"
    display_name: str
    real_name: str
    full_path: str
    scan_time: str
    size_bytes: int
    device_id: int


class Config(TypedDict):
    paths: dict
    settings: dict
    source_sets: dict
    dest_sets: dict


class MountLayoutWarningPayload(TypedDict):
    code: str
    severity: str
    title: str
    detail: str
    recommendation: str


# ---------------------------------------------------------------------------
# Custom exceptions (0.2.0+)
# These replace sys.exit() calls in reusable engine functions so that the
# web layer can handle failures without killing the server process.
# ---------------------------------------------------------------------------

class HardlinkOrganizerError(Exception):
    """Base exception for all hardlink organizer errors."""


class ConfigError(HardlinkOrganizerError):
    """Raised when the config file is missing, invalid, or cannot be loaded."""


class ScanError(HardlinkOrganizerError):
    """Raised when a scan operation cannot proceed (e.g. unknown source set)."""


class ValidationError(HardlinkOrganizerError):
    """Raised when a pre-execution validation check fails."""


class LinkError(HardlinkOrganizerError):
    """Raised when a link operation fails fatally before any files are written."""


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

_logger = logging.getLogger("hardlink_organizer")


def setup_logging(log_file: str | None, verbose: bool = False) -> None:
    """Configure root logger with console and optional file handler."""
    level = logging.DEBUG if verbose else logging.INFO
    fmt = "%(asctime)s %(levelname)-8s %(message)s"
    datefmt = "%Y-%m-%dT%H:%M:%S"

    logging.basicConfig(level=level, format=fmt, datefmt=datefmt)

    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))
        logging.getLogger().addHandler(fh)


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_config(config_path: str) -> Config:
    """Load and minimally validate a TOML config file."""
    if tomllib is None:
        raise ConfigError(
            "No TOML library available. Python 3.11+ includes tomllib. "
            "For older versions, install tomli: pip install tomli"
        )

    p = Path(config_path)
    if not p.is_file():
        raise ConfigError(f"Config file not found: {config_path}")

    with open(p, "rb") as fh:
        raw = tomllib.load(fh)

    # Provide sensible defaults
    cfg: Config = {
        "paths": raw.get("paths", {}),
        "settings": raw.get("settings", {}),
        "source_sets": raw.get("source_sets", {}),
        "dest_sets": raw.get("dest_sets", {}),
    }

    if not cfg["source_sets"]:
        _logger.warning("Config has no [source_sets] entries.")
    if not cfg["dest_sets"]:
        _logger.warning("Config has no [dest_sets] entries.")

    return cfg


# ---------------------------------------------------------------------------
# Display-name generation
# ---------------------------------------------------------------------------

_YEAR_RE = re.compile(r"(?<!\d)((?:19|20)\d{2})(?!\d)")


def generate_display_name(real_name: str) -> str:
    """
    Derive a human-readable display name from a raw filesystem entry name.

    Rules (conservative):
    - Replace dots and underscores with spaces.
    - Collapse repeated whitespace.
    - Trim leading/trailing whitespace.
    - Preserve obvious 4-digit year tokens (1900-2099).
    - Do NOT use this value for filesystem operations.
    """
    name = real_name

    # Strip file extension for display if it's a plain file with a known extension,
    # but leave directory names alone.
    # We keep extensions for ambiguous cases; only strip common video/audio ones.
    _strip_exts = {
        ".mkv", ".mp4", ".avi", ".mov", ".m4v", ".ts", ".flv",
        ".mp3", ".flac", ".m4a", ".ogg", ".aac", ".wav",
        ".epub", ".pdf", ".cbz", ".cbr",
    }
    suffix = Path(name).suffix.lower()
    if suffix in _strip_exts:
        name = Path(name).stem

    # Replace dots and underscores with spaces
    name = name.replace(".", " ").replace("_", " ")

    # Collapse repeated whitespace
    name = re.sub(r"\s+", " ", name)

    # Trim
    name = name.strip()

    # Attempt to reformat year tokens as (YYYY) if not already parenthesised
    def _reformat_year(m: re.Match) -> str:  # type: ignore[type-arg]
        year = m.group(1)
        # Only wrap if not already wrapped
        start = m.start(1)
        full = m.string
        if start > 0 and full[start - 1] == "(":
            return m.group(0)
        return f"({year})"

    name = _YEAR_RE.sub(_reformat_year, name)

    # Collapse again after year formatting
    name = re.sub(r"\s+", " ", name).strip()

    return name


def suggest_destination_name(display_name: str) -> str:
    """Return a clean suggested destination folder name from a display name."""
    return display_name


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------

def _stat_entry(path: Path) -> tuple[int, int]:
    """Return (size_bytes, device_id) for a path. Returns (0, 0) on error."""
    try:
        st = path.stat()
        return st.st_size, st.st_dev
    except OSError:
        return 0, 0


def scan_source_set(set_name: str, root: str, include_hidden: bool = False) -> list[InventoryEntry]:
    """
    Scan top-level entries in *root* and return a list of InventoryEntry dicts.
    Entries are sorted deterministically: directories first, then files,
    each group sorted case-insensitively by real_name.
    """
    root_path = Path(root)
    if not root_path.is_dir():
        _logger.warning("Source set %r root does not exist or is not a directory: %s", set_name, root)
        return []

    scan_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    entries: list[InventoryEntry] = []

    try:
        children = list(root_path.iterdir())
    except PermissionError as exc:
        _logger.error("Cannot read source set %r root: %s", set_name, exc)
        return []

    dirs: list[Path] = []
    files: list[Path] = []
    for child in children:
        if not include_hidden and child.name.startswith("."):
            continue
        if child.is_symlink():
            # Treat symlinks by what they resolve to
            if child.is_dir():
                dirs.append(child)
            else:
                files.append(child)
        elif child.is_dir():
            dirs.append(child)
        elif child.is_file():
            files.append(child)
        # Ignore block devices, sockets, etc.

    dirs.sort(key=lambda p: p.name.lower())
    files.sort(key=lambda p: p.name.lower())

    ordered = dirs + files

    for idx, child in enumerate(ordered, start=1):
        size_bytes, device_id = _stat_entry(child)
        entry: InventoryEntry = {
            "id": idx,
            "source_set": set_name,
            "entry_type": "dir" if child.is_dir() else "file",
            "display_name": generate_display_name(child.name),
            "real_name": child.name,
            "full_path": str(child),  # preserve literal scanned path; do not resolve symlinks
            "scan_time": scan_time,
            "size_bytes": size_bytes,
            "device_id": device_id,
        }
        entries.append(entry)

    return entries


def scan_all_sets(cfg: Config, set_filter: str | None = None) -> list[InventoryEntry]:
    """
    Scan one or all source sets.

    If *set_filter* is provided, only that set is scanned.
    IDs are re-assigned globally after all sets are merged so they remain
    unique and deterministic across the full index.
    """
    include_hidden = cfg["settings"].get("include_hidden", False)
    source_sets = cfg["source_sets"]

    if set_filter:
        if set_filter not in source_sets:
            raise ScanError(
                f"Source set {set_filter!r} not found in config. "
                f"Available: {list(source_sets)}"
            )
        sets_to_scan = {set_filter: source_sets[set_filter]}
    else:
        sets_to_scan = source_sets

    all_entries: list[InventoryEntry] = []
    for name, root in sets_to_scan.items():
        entries = scan_source_set(name, root, include_hidden=include_hidden)
        _logger.info("Scanned source set %r: %d entries found.", name, len(entries))
        all_entries.extend(entries)

    # Re-assign globally unique IDs
    for global_id, entry in enumerate(all_entries, start=1):
        entry["id"] = global_id

    return all_entries


# ---------------------------------------------------------------------------
# Index persistence
# ---------------------------------------------------------------------------

_TSV_FIELDS = ["id", "source_set", "entry_type", "display_name", "real_name", "full_path", "scan_time", "size_bytes", "device_id"]


def write_index_json(entries: list[InventoryEntry], path: str) -> None:
    """Write *entries* to *path* as a JSON array."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=2, ensure_ascii=False)
    _logger.info("JSON index written: %s (%d entries)", path, len(entries))


def write_index_tsv(entries: list[InventoryEntry], path: str) -> None:
    """Write *entries* to *path* as a TSV file with a header row."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_TSV_FIELDS, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(entries)
    _logger.info("TSV index written: %s (%d entries)", path, len(entries))


def load_index(json_path: str) -> list[InventoryEntry]:
    """Load a previously written JSON index."""
    p = Path(json_path)
    if not p.is_file():
        return []
    with open(p, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------

def list_entries(entries: list[InventoryEntry], source_set: str | None = None) -> list[InventoryEntry]:
    """Filter *entries* to a given source set (or return all)."""
    if source_set:
        return [e for e in entries if e["source_set"] == source_set]
    return list(entries)


def print_entries(entries: list[InventoryEntry]) -> None:
    """Render a numbered, human-readable list of entries to stdout."""
    if not entries:
        print("  (no entries)")
        return
    id_width = len(str(entries[-1]["id"]))
    for entry in entries:
        marker = "D" if entry["entry_type"] == "dir" else "F"
        print(f"  [{entry['id']:>{id_width}}] [{marker}] {entry['display_name']}")
        print(f"          real: {entry['real_name']}")


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_source(entry: InventoryEntry) -> bool:
    """Confirm the source path still exists on disk."""
    p = Path(entry["full_path"])
    if not p.exists():
        _logger.error("Source no longer exists: %s", entry["full_path"])
        return False
    return True


def validate_dest_root(dest_root: str) -> bool:
    """Confirm the configured destination root exists."""
    p = Path(dest_root)
    if not p.is_dir():
        _logger.error("Destination root does not exist or is not a directory: %s", dest_root)
        return False
    return True


def validate_same_device(source_path: str, dest_root: str) -> bool:
    """
    Compare st_dev of the source item and the destination root.
    Returns True if they share the same device.
    """
    try:
        src_dev = Path(source_path).stat().st_dev
        dst_dev = Path(dest_root).stat().st_dev
    except OSError as exc:
        _logger.error("Device check failed: %s", exc)
        return False
    if src_dev != dst_dev:
        _logger.error(
            "Cross-device hardlink refused. Source device=%d, dest device=%d",
            src_dev, dst_dev,
        )
        return False
    return True


@dataclass(frozen=True)
class MountLayoutWarning:
    code: str
    title: str
    detail: str
    recommendation: str
    severity: str = "warning"

    def as_payload(self) -> MountLayoutWarningPayload:
        return {
            "code": self.code,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "recommendation": self.recommendation,
        }


@dataclass(frozen=True)
class MountLayoutAssessment:
    same_device: bool | None
    source_mount_point: str | None
    dest_mount_point: str | None
    warnings: tuple[MountLayoutWarning, ...] = ()


_UNRAID_SHARE_RECOMMENDATION = (
    "Prefer a shared disk-level or pool-level parent bind mount such as "
    "/mnt/disk3:/mnt/disk3, then point both source and destination config paths "
    "inside that single mount."
)

_MERGERFS_RECOMMENDATION = (
    "Prefer mounting the underlying disk path directly instead of the MergerFS "
    "pool. For example, use /srv/dev-disk-by-label/MyDisk:/mnt/media instead of "
    "/srv/mergerfs/pool:/mnt/media. Both source and destination must resolve to "
    "the same underlying filesystem for hardlinks to succeed."
)


def _unescape_mountinfo_path(value: str) -> str:
    """Decode the limited escape sequences used in /proc/self/mountinfo."""
    return (
        value.replace("\\040", " ")
        .replace("\\011", "\t")
        .replace("\\012", "\n")
        .replace("\\134", "\\")
    )


def _load_mount_points(mountinfo_text: str | None = None) -> list[str]:
    """Return normalized mount points from mountinfo, longest paths first."""
    if mountinfo_text is None:
        try:
            mountinfo_text = Path("/proc/self/mountinfo").read_text(encoding="utf-8")
        except OSError:
            return []

    mount_points: list[str] = []
    seen: set[str] = set()
    for raw_line in mountinfo_text.splitlines():
        if " - " not in raw_line:
            continue
        pre, _ = raw_line.split(" - ", 1)
        fields = pre.split()
        if len(fields) < 5:
            continue
        mount_point = os.path.normpath(_unescape_mountinfo_path(fields[4]))
        if mount_point not in seen:
            mount_points.append(mount_point)
            seen.add(mount_point)

    mount_points.sort(key=len, reverse=True)
    return mount_points


def _find_mount_point(path: str, mount_points: list[str]) -> str | None:
    """Return the most specific mount point that contains *path*."""
    normalized = os.path.normpath(path)
    for mount_point in mount_points:
        if mount_point == "/":
            return mount_point
        if normalized == mount_point or normalized.startswith(f"{mount_point}/"):
            return mount_point
    return None


def _classify_mount_layout_path(path: str) -> str:
    """Classify a path into a coarse platform-aware layout kind."""
    normalized = os.path.normpath(path)
    if normalized == "/mnt/user" or normalized.startswith("/mnt/user/"):
        return "user_share"
    if normalized == "/mnt/src" or normalized.startswith("/mnt/src/"):
        return "container_source_mount"
    if normalized == "/mnt/dst" or normalized.startswith("/mnt/dst/"):
        return "container_dest_mount"
    if re.match(r"^/mnt/disk\d+(?:/|$)", normalized):
        return "disk_mount"
    if re.match(r"^/mnt/(?:cache|pool[^/]*)(?:/|$)", normalized):
        return "pool_mount"
    # MergerFS union mount — OMV default pool path (same EXDEV risk as Unraid shfs)
    if normalized == "/srv/mergerfs" or normalized.startswith("/srv/mergerfs/"):
        return "mergerfs_pool"
    # OMV underlying disk paths — direct access, safe (equivalent to Unraid disk_mount)
    if re.match(r"^/srv/dev-disk-by-(?:label|uuid|id)/", normalized):
        return "omv_disk_mount"
    return "other"


def assess_mount_layout(
    source_path: str,
    dest_root: str,
    *,
    source_device: int | None = None,
    dest_device: int | None = None,
    mountinfo_text: str | None = None,
) -> MountLayoutAssessment:
    """
    Assess whether the current source/destination layout is likely to be risky.

    This is warning-oriented rather than block-oriented. The normal same-device
    validation still controls whether a plan is executable.
    """
    if source_device is None:
        try:
            source_device = Path(source_path).stat().st_dev
        except OSError:
            source_device = None

    if dest_device is None:
        try:
            dest_device = Path(dest_root).stat().st_dev
        except OSError:
            dest_device = None

    same_device: bool | None = None
    if source_device is not None and dest_device is not None:
        same_device = source_device == dest_device

    mount_points = _load_mount_points(mountinfo_text)
    source_mount_point = _find_mount_point(source_path, mount_points)
    dest_mount_point = _find_mount_point(dest_root, mount_points)
    source_kind = _classify_mount_layout_path(source_path)
    dest_kind = _classify_mount_layout_path(dest_root)

    warnings: list[MountLayoutWarning] = []

    if source_kind == "user_share" or dest_kind == "user_share":
        warnings.append(
            MountLayoutWarning(
                code="unraid_share_path",
                title="/mnt/user paths can look safe while still failing",
                detail=(
                    "At least one path uses /mnt/user. On Unraid, share-style paths can "
                    "hide the real disk layout, so preview may look same-device while a "
                    "real hardlink later fails with EXDEV."
                ),
                recommendation=_UNRAID_SHARE_RECOMMENDATION,
            )
        )

    if source_kind == "mergerfs_pool" or dest_kind == "mergerfs_pool":
        warnings.append(
            MountLayoutWarning(
                code="mergerfs_pool_path",
                title="MergerFS pool paths can hide device layout and cause EXDEV",
                detail=(
                    "At least one path is under a MergerFS pool mount (/srv/mergerfs/). "
                    "Like Unraid's /mnt/user, MergerFS pools can report the same device "
                    "ID while a real hardlink operation later fails with EXDEV because "
                    "the underlying files resolve to different physical disks."
                ),
                recommendation=_MERGERFS_RECOMMENDATION,
            )
        )

    if (
        same_device is True
        and source_mount_point
        and dest_mount_point
        and source_mount_point != dest_mount_point
        and (
            source_kind != "other"
            or dest_kind != "other"
            or source_mount_point.startswith("/mnt/")
            or dest_mount_point.startswith("/mnt/")
            or source_mount_point.startswith("/srv/")
            or dest_mount_point.startswith("/srv/")
        )
    ):
        _separate_recommendation = (
            _MERGERFS_RECOMMENDATION
            if (source_kind == "mergerfs_pool" or dest_kind == "mergerfs_pool")
            else _UNRAID_SHARE_RECOMMENDATION
        )
        warnings.append(
            MountLayoutWarning(
                code="separate_mount_points",
                title="Separate container mounts may still fail with EXDEV",
                detail=(
                    "These paths currently report the same device, but they resolve "
                    f"through different mount points ({source_mount_point} vs "
                    f"{dest_mount_point}). Real tests showed this layout can "
                    "still fail during hardlink execution."
                ),
                recommendation=_separate_recommendation,
            )
        )

    return MountLayoutAssessment(
        same_device=same_device,
        source_mount_point=source_mount_point,
        dest_mount_point=dest_mount_point,
        warnings=tuple(warnings),
    )


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------

class LinkPlan:
    """Describes a planned link operation before any mutation occurs."""

    def __init__(
        self,
        source_path: str,
        dest_root: str,
        dest_subpath: str,
        entry_type: str,
        display_name: str,
    ) -> None:
        self.source_path = source_path
        self.dest_root = dest_root
        self.dest_subpath = dest_subpath
        self.entry_type = entry_type
        self.display_name = display_name
        self.dest_full = str(Path(dest_root) / dest_subpath)
        self.mount_layout = assess_mount_layout(source_path, dest_root)
        self.warnings = [warning.as_payload() for warning in self.mount_layout.warnings]

    def is_valid(self) -> tuple[bool, list[str]]:
        """Run all pre-execution validations. Returns (ok, list_of_errors)."""
        errors: list[str] = []

        src = Path(self.source_path)
        if not src.exists():
            errors.append(f"Source does not exist: {self.source_path}")

        dst_root = Path(self.dest_root)
        if not dst_root.is_dir():
            errors.append(f"Destination root does not exist: {self.dest_root}")

        if src.exists() and dst_root.is_dir():
            try:
                src_dev = src.stat().st_dev
                dst_dev = dst_root.stat().st_dev
            except OSError as exc:
                errors.append(f"Device check error: {exc}")
            else:
                if src_dev != dst_dev:
                    errors.append(
                        f"Cross-device hardlink refused "
                        f"(source device={src_dev}, dest device={dst_dev})"
                    )

            # Ensure dest_full resolves to a path inside dest_root.
            try:
                resolved_full = Path(self.dest_full).resolve()
                resolved_root = Path(self.dest_root).resolve()
                resolved_full.relative_to(resolved_root)
            except ValueError:
                errors.append(
                    f"Destination path escapes destination root: {self.dest_full}"
                )

        return (len(errors) == 0, errors)

    def print_preview(self) -> None:
        """Render a human-readable preview to stdout."""
        ok, errors = self.is_valid()
        print("\n-- Link Plan Preview ------------------------------------------")
        print(f"  Display name : {self.display_name}")
        print(f"  Entry type   : {self.entry_type}")
        print(f"  Source       : {self.source_path}")
        print(f"  Dest root    : {self.dest_root}")
        print(f"  Dest subpath : {self.dest_subpath}")
        print(f"  Dest full    : {self.dest_full}")
        if ok:
            print("  Validation   : OK")
        else:
            print("  Validation   : FAILED")
            for err in errors:
                print(f"    - {err}")
        if self.warnings:
            print("  Warnings     :")
            for warning in self.warnings:
                print(f"    - {warning['title']}")
                print(f"      {warning['detail']}")
                print(f"      Recommendation: {warning['recommendation']}")
        print("---------------------------------------------------------------\n")


def build_link_plan(
    entry: InventoryEntry,
    dest_root: str,
    dest_subpath: str | None,
) -> LinkPlan:
    """Build a LinkPlan from an inventory entry and destination info."""
    if not dest_subpath:
        dest_subpath = suggest_destination_name(entry["display_name"])
    return LinkPlan(
        source_path=entry["full_path"],
        dest_root=dest_root,
        dest_subpath=dest_subpath,
        entry_type=entry["entry_type"],
        display_name=entry["display_name"],
    )


# ---------------------------------------------------------------------------
# Hardlink execution
# ---------------------------------------------------------------------------

class LinkResult:
    def __init__(self) -> None:
        self.linked: list[str] = []
        self.skipped: list[str] = []
        self.failed: list[str] = []

    @property
    def total(self) -> int:
        return len(self.linked) + len(self.skipped) + len(self.failed)

    def print_summary(self) -> None:
        print("\n-- Link Summary ------------------------------------------------")
        print(f"  Linked  : {len(self.linked)}")
        print(f"  Skipped : {len(self.skipped)}")
        print(f"  Failed  : {len(self.failed)}")
        print("---------------------------------------------------------------\n")

    def log_summary(self) -> None:
        _logger.info(
            "Link summary - linked=%d skipped=%d failed=%d total=%d",
            len(self.linked), len(self.skipped), len(self.failed), self.total,
        )


def hardlink_file(src: Path, dst: Path, result: LinkResult, dry_run: bool = False) -> None:
    """
    Create a hardlink at *dst* pointing to *src*.
    Skips if *dst* already exists. Never overwrites.
    """
    if dst.exists():
        try:
            if os.path.samestat(src.stat(), dst.stat()):
                _logger.debug("SKIP (already linked): %s", dst)
            else:
                _logger.warning("SKIP (collision — unrelated file exists): %s", dst)
        except OSError:
            _logger.debug("SKIP (exists, stat failed): %s", dst)
        result.skipped.append(str(dst))
        return

    if dry_run:
        _logger.info("DRY-RUN link: %s -> %s", src, dst)
        result.linked.append(str(dst))
        return

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        os.link(src, dst)
        _logger.info("LINKED: %s -> %s", src, dst)
        result.linked.append(str(dst))
    except OSError as exc:
        _logger.error("FAILED link %s -> %s : %s", src, dst, exc)
        result.failed.append(str(dst))


def hardlink_tree(
    src_dir: Path,
    dst_dir: Path,
    result: LinkResult,
    dry_run: bool = False,
) -> None:
    """
    Recursively replicate *src_dir* into *dst_dir*, hardlinking all files.
    Directories are created normally (never hardlinked).
    Continues past individual file failures.
    """
    if not dry_run:
        try:
            dst_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            _logger.error("Cannot create directory %s: %s", dst_dir, exc)
            result.failed.append(str(dst_dir))
            return

    try:
        children = list(src_dir.iterdir())
    except PermissionError as exc:
        _logger.error("Cannot read directory %s: %s", src_dir, exc)
        result.failed.append(str(src_dir))
        return

    for child in sorted(children, key=lambda p: (p.is_file(), p.name.lower())):
        rel = child.relative_to(src_dir)
        target = dst_dir / rel
        if child.is_dir():
            hardlink_tree(child, target, result, dry_run=dry_run)
        elif child.is_file():
            hardlink_file(child, target, result, dry_run=dry_run)
        else:
            _logger.debug("SKIP (non-file/dir): %s", child)


def execute_link_plan(plan: LinkPlan, dry_run: bool = False) -> LinkResult | None:
    """
    Execute *plan*. Returns a LinkResult or None if validation failed.
    """
    ok, errors = plan.is_valid()
    if not ok:
        for err in errors:
            _logger.error("Validation: %s", err)
        return None

    result = LinkResult()
    src = Path(plan.source_path)
    dst = Path(plan.dest_full)

    if plan.entry_type == "file":
        hardlink_file(src, dst, result, dry_run=dry_run)
    else:
        hardlink_tree(src, dst, result, dry_run=dry_run)

    result.log_summary()
    return result


# ---------------------------------------------------------------------------
# Interactive flow
# ---------------------------------------------------------------------------

def _prompt(msg: str, default: str = "") -> str:
    """Prompt the user for input with an optional default."""
    suffix = f" [{default}]" if default else ""
    try:
        val = input(f"{msg}{suffix}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)
    return val if val else default


def _choose_from_list(label: str, options: list[str]) -> str:
    """Present a numbered list and return the chosen value."""
    print(f"\nAvailable {label}:")
    for idx, opt in enumerate(options, start=1):
        print(f"  [{idx}] {opt}")
    while True:
        raw = _prompt(f"Select {label} (1-{len(options)})")
        try:
            choice = int(raw)
            if 1 <= choice <= len(options):
                return options[choice - 1]
        except (ValueError, TypeError):
            pass
        print(f"  Enter a number between 1 and {len(options)}.")


def run_interactive_flow(cfg: Config, index_json: str) -> None:
    """
    Guided interactive workflow:
    1. Choose source set.
    2. Choose entry.
    3. Choose destination set.
    4. Confirm or edit destination subpath.
    5. Preview + confirm.
    6. Execute.
    """
    print("\n== Hardlink Organizer - Interactive Mode ====================\n")

    source_sets = cfg["source_sets"]
    dest_sets = cfg["dest_sets"]

    if not source_sets:
        _logger.error("No source sets configured.")
        sys.exit(1)
    if not dest_sets:
        _logger.error("No destination sets configured.")
        sys.exit(1)

    # Step 1: source set
    src_set_name = _choose_from_list("source set", list(source_sets.keys()))
    src_root = source_sets[src_set_name]

    # Step 2: scan / load entries for chosen set
    include_hidden = cfg["settings"].get("include_hidden", False)
    entries = scan_source_set(src_set_name, src_root, include_hidden=include_hidden)

    if not entries:
        print(f"\n  No entries found in source set '{src_set_name}' ({src_root}).")
        return

    print(f"\nEntries in '{src_set_name}':")
    print_entries(entries)

    while True:
        raw = _prompt(f"\nSelect entry ID (1-{len(entries)})")
        try:
            entry_id = int(raw)
            matched = [e for e in entries if e["id"] == entry_id]
            if matched:
                chosen_entry = matched[0]
                break
        except (ValueError, TypeError):
            pass
        print("  Invalid entry ID.")

    # Step 3: destination set
    dst_set_name = _choose_from_list("destination set", list(dest_sets.keys()))
    dst_root = dest_sets[dst_set_name]

    # Step 4: destination subpath
    suggested = suggest_destination_name(chosen_entry["display_name"])
    print(f"\n  Suggested destination subpath: {suggested}")
    dest_subpath = _prompt("Destination subpath (press Enter to accept suggestion)", default=suggested)

    # Step 5: preview
    plan = build_link_plan(chosen_entry, dst_root, dest_subpath)
    plan.print_preview()

    ok, errors = plan.is_valid()
    if not ok:
        print("  Cannot proceed: validation failed (see above).")
        return

    dry_raw = _prompt("Dry run? (y/n)", default="y").lower()
    dry_run = dry_raw.startswith("y")

    if dry_run:
        print("\n  [DRY RUN - no files will be written]\n")
    else:
        confirm = _prompt("Proceed with real hardlink operation? (yes/no)", default="no").lower()
        if confirm != "yes":
            print("  Aborted.")
            return

    result = execute_link_plan(plan, dry_run=dry_run)
    if result:
        result.print_summary()


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------

def cmd_scan(cfg: Config, args: argparse.Namespace) -> None:
    entries = scan_all_sets(cfg, set_filter=getattr(args, "set", None))
    json_out = getattr(args, "json_out", None) or cfg["paths"].get("index_json", "hardlink-index.json")
    tsv_out = getattr(args, "tsv_out", None) or cfg["paths"].get("index_tsv", "hardlink-index.tsv")
    write_index_json(entries, json_out)
    write_index_tsv(entries, tsv_out)
    print(f"Scanned {len(entries)} entries total.")
    print(f"  JSON: {json_out}")
    print(f"  TSV : {tsv_out}")


def cmd_list(cfg: Config, args: argparse.Namespace) -> None:
    source_set = args.source_set
    json_out = cfg["paths"].get("index_json", "hardlink-index.json")

    # Try loading from a saved index first; fall back to a live scan
    entries = load_index(json_out)
    if not entries:
        _logger.debug("No saved index found at %s; running live scan.", json_out)
        include_hidden = cfg["settings"].get("include_hidden", False)
        src_root = cfg["source_sets"].get(source_set)
        if not src_root:
            _logger.error("Source set %r not found in config.", source_set)
            sys.exit(1)
        entries = scan_source_set(source_set, src_root, include_hidden=include_hidden)

    filtered = list_entries(entries, source_set)

    if not filtered:
        print(f"  No entries for source set '{source_set}'.")
        return

    print(f"\nSource set '{source_set}':")
    print_entries(filtered)
    print(f"\n  {len(filtered)} entries.")


def cmd_link(cfg: Config, args: argparse.Namespace) -> None:
    source_set: str = args.source_set
    entry_id: int = args.entry_id
    dest_set: str = args.dest_set
    dest_subpath: str | None = getattr(args, "dest_subpath", None)
    dry_run: bool = args.dry_run

    json_out = cfg["paths"].get("index_json", "hardlink-index.json")

    # Load saved index or do a live scan
    entries = load_index(json_out)
    if not entries:
        _logger.debug("No saved index; running live scan for set %r.", source_set)
        include_hidden = cfg["settings"].get("include_hidden", False)
        src_root = cfg["source_sets"].get(source_set)
        if not src_root:
            _logger.error("Source set %r not found in config.", source_set)
            sys.exit(1)
        entries = scan_source_set(source_set, src_root, include_hidden=include_hidden)

    filtered = list_entries(entries, source_set)
    matched = [e for e in filtered if e["id"] == entry_id]
    if not matched:
        _logger.error(
            "Entry ID %d not found in source set %r. Run 'list %s' to see valid IDs.",
            entry_id, source_set, source_set
        )
        sys.exit(1)

    entry = matched[0]

    dst_root = cfg["dest_sets"].get(dest_set)
    if not dst_root:
        _logger.error("Destination set %r not found in config.", dest_set)
        sys.exit(1)

    plan = build_link_plan(entry, dst_root, dest_subpath)
    plan.print_preview()

    ok, _ = plan.is_valid()
    if not ok:
        _logger.error("Validation failed; aborting.")
        sys.exit(1)

    if not dry_run:
        confirm = _prompt("Proceed with real hardlink operation? (yes/no)", default="no").lower()
        if confirm != "yes":
            print("  Aborted.")
            return

    result = execute_link_plan(plan, dry_run=dry_run)
    if result:
        result.print_summary()


def cmd_interactive(cfg: Config, args: argparse.Namespace) -> None:
    json_out = cfg["paths"].get("index_json", "hardlink-index.json")
    run_interactive_flow(cfg, json_out)


def cmd_validate(cfg: Config, args: argparse.Namespace) -> None:
    source_path: str = args.source_path
    dest_root: str = args.dest_root

    print(f"\nValidating:")
    print(f"  Source: {source_path}")
    print(f"  Dest  : {dest_root}\n")

    src_ok = Path(source_path).exists()
    dst_ok = validate_dest_root(dest_root)

    print(f"  Source exists : {'OK' if src_ok else 'MISSING'}")
    print(f"  Dest root     : {'OK' if dst_ok else 'MISSING'}")

    if src_ok and dst_ok:
        same = validate_same_device(source_path, dest_root)
        if same:
            src_dev = Path(source_path).stat().st_dev
            print(f"  Same device   : OK (device {src_dev})")
        else:
            print("  Same device   : FAILED — cross-device hardlink not allowed")
    else:
        print("  Same device   : SKIPPED (prior checks failed)")


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hardlink-organizer",
        description="Hardlink Organizer — safely inventory and hardlink media torrent payloads.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    parser.add_argument(
        "--config", "-c",
        required=True,
        metavar="PATH",
        help="Path to the TOML configuration file.",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose/debug logging.",
    )

    sub = parser.add_subparsers(dest="command", metavar="COMMAND")
    sub.required = True

    # scan
    p_scan = sub.add_parser("scan", help="Scan source sets and write inventory.")
    p_scan.add_argument("--set", metavar="NAME", dest="set", help="Scan only this source set.")
    p_scan.add_argument("--json-out", metavar="PATH", dest="json_out", help="Override JSON output path.")
    p_scan.add_argument("--tsv-out", metavar="PATH", dest="tsv_out", help="Override TSV output path.")

    # list
    p_list = sub.add_parser("list", help="List entries for a source set.")
    p_list.add_argument("source_set", metavar="SOURCE_SET", help="Name of the source set to list.")

    # link
    p_link = sub.add_parser("link", help="Hardlink a specific entry into a destination set.")
    p_link.add_argument("source_set", metavar="SOURCE_SET", help="Name of the source set.")
    p_link.add_argument("entry_id", metavar="ENTRY_ID", type=int, help="Numeric ID of the entry to link.")
    p_link.add_argument("dest_set", metavar="DEST_SET", help="Name of the destination set.")
    p_link.add_argument("--dest-subpath", metavar="PATH", dest="dest_subpath", help="Override destination folder name.")
    p_link.add_argument("--dry-run", action="store_true", help="Preview without writing any files.")

    # interactive
    sub.add_parser("interactive", help="Guided interactive selection and link workflow.")

    # validate
    p_val = sub.add_parser("validate", help="Check source/destination compatibility.")
    p_val.add_argument("source_path", metavar="SOURCE_PATH", help="Path to the source item.")
    p_val.add_argument("dest_root", metavar="DEST_ROOT", help="Path to the destination root.")

    return parser


_COMMAND_HANDLERS = {
    "scan": cmd_scan,
    "list": cmd_list,
    "link": cmd_link,
    "interactive": cmd_interactive,
    "validate": cmd_validate,
}


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    log_file = cfg["paths"].get("log_file")
    setup_logging(log_file, verbose=args.verbose)

    handler = _COMMAND_HANDLERS.get(args.command)
    if handler is None:
        parser.print_help()
        return 1

    try:
        handler(cfg, args)
    except (ScanError, ValidationError, LinkError) as exc:
        _logger.error("%s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
