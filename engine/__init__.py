"""
Engine package for Hardlink Organizer.

Re-exports all public symbols from hardlink_organizer.py, including the new
typed exceptions introduced in 0.2.0 so the web layer never needs to import
the monolithic module directly.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure the tool root (containing hardlink_organizer.py) is importable.
_TOOL_DIR = Path(__file__).resolve().parent.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

from hardlink_organizer import (  # noqa: E402
    __version__,
    Config,
    InventoryEntry,
    LinkPlan,
    LinkResult,
    setup_logging,
    load_config,
    generate_display_name,
    suggest_destination_name,
    scan_source_set,
    scan_all_sets,
    write_index_json,
    write_index_tsv,
    load_index,
    list_entries,
    validate_source,
    validate_dest_root,
    validate_same_device,
    build_link_plan,
    execute_link_plan,
    hardlink_file,
    hardlink_tree,
    ConfigError,
    ScanError,
    ValidationError,
    LinkError,
)

__all__ = [
    "__version__",
    "Config",
    "InventoryEntry",
    "LinkPlan",
    "LinkResult",
    "setup_logging",
    "load_config",
    "generate_display_name",
    "suggest_destination_name",
    "scan_source_set",
    "scan_all_sets",
    "write_index_json",
    "write_index_tsv",
    "load_index",
    "list_entries",
    "validate_source",
    "validate_dest_root",
    "validate_same_device",
    "build_link_plan",
    "execute_link_plan",
    "hardlink_file",
    "hardlink_tree",
    "ConfigError",
    "ScanError",
    "ValidationError",
    "LinkError",
]
