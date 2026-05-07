"""
Pydantic request and response models for the Hardlink Organizer web API.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Config / Sets
# ---------------------------------------------------------------------------

class SetsResponse(BaseModel):
    source_sets: dict[str, str]
    dest_sets: dict[str, str]


class ScanSummary(BaseModel):
    source_set: str
    scan_time: str | None
    entry_count: int | None


class SetsWithStatusResponse(BaseModel):
    source_sets: dict[str, str]
    dest_sets: dict[str, str]
    scan_summaries: dict[str, ScanSummary]


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    source_set: str | None = None   # None = scan all sets


class ScanResponse(BaseModel):
    scanned_sets: list[str]
    total_entries: int
    per_set: dict[str, int]


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class InventoryEntry(BaseModel):
    id: int
    source_set: str
    entry_type: str          # "file" or "dir"
    display_name: str
    real_name: str
    full_path: str
    scan_time: str
    size_bytes: int
    device_id: int
    linked: bool = False     # populated from link history


class InventoryResponse(BaseModel):
    source_set: str
    entries: list[InventoryEntry]
    scan_time: str | None = None
    from_db: bool = False    # True = served from DB, False = live scan


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------

class PreviewRequest(BaseModel):
    source_set: str
    entry_id: int
    dest_set: str
    dest_subpath: str | None = None


class PreviewWarning(BaseModel):
    code: str
    severity: str
    title: str
    detail: str
    recommendation: str


class PreviewResponse(BaseModel):
    source_set: str
    real_name: str
    display_name: str
    entry_type: str
    source_path: str
    dest_set: str
    dest_root: str
    dest_subpath: str
    dest_full: str
    valid: bool
    errors: list[str]
    warnings: list[PreviewWarning] = Field(default_factory=list)
    previously_linked: bool = False


# ---------------------------------------------------------------------------
# Execute
# ---------------------------------------------------------------------------

class ExecuteRequest(BaseModel):
    source_set: str
    entry_id: int
    dest_set: str
    dest_subpath: str
    dry_run: bool = False


class ExecuteResponse(BaseModel):
    success: bool
    dry_run: bool
    linked: int
    skipped: int
    failed: int
    linked_files: list[str]
    skipped_files: list[str]
    failed_files: list[str]
    errors: list[str]
    history_id: int | None = None


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

class HistoryEntry(BaseModel):
    id: int
    source_set: str
    real_name: str
    full_path: str
    dest_set: str
    dest_root: str
    dest_subpath: str
    dest_full: str
    linked_count: int
    skipped_count: int
    failed_count: int
    dry_run: bool
    linked_at: str
    notes: str | None = None
    display_name: str | None = None


class HistoryResponse(BaseModel):
    history: list[HistoryEntry]
    total: int


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    version: str
    config_loaded: bool
    db_path: str | None


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

class VerifyRequest(BaseModel):
    mode: str = "link_history"
    link_history_id: int


class VerificationResultItem(BaseModel):
    id: int
    source_path: str
    candidate_dest: str
    source_dev: int | None = None
    source_inode: int | None = None
    source_nlink: int | None = None
    dest_dev: int | None = None
    dest_inode: int | None = None
    dest_nlink: int | None = None
    status: str
    notes: str | None = None


class VerificationRunResponse(BaseModel):
    run_id: int
    created_at: str
    mode: str
    source_set: str | None = None
    dest_set: str | None = None
    link_history_id: int | None = None
    verified_count: int
    failed_count: int
    missing_count: int
    error_count: int
    notes: str | None = None
    results: list[VerificationResultItem]


# ---------------------------------------------------------------------------
# Destination registry
# ---------------------------------------------------------------------------

class DestinationCreate(BaseModel):
    label: str
    path: str
    tag: Optional[str] = None
    enabled: bool = True
    notes: Optional[str] = None


class DestinationUpdate(BaseModel):
    label: Optional[str] = None
    path: Optional[str] = None
    tag: Optional[str] = None
    enabled: Optional[bool] = None
    notes: Optional[str] = None


class DestinationEntry(BaseModel):
    id: int
    label: str
    path: str
    tag: Optional[str] = None
    enabled: bool
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class DestinationListResponse(BaseModel):
    destinations: list[DestinationEntry]
    total: int


class DestinationValidateRequest(BaseModel):
    path: str


class DestinationValidateChecks(BaseModel):
    exists: bool
    is_directory: bool
    is_writable: Optional[bool] = None
    is_unsafe_root: bool


class DestinationValidateWarning(BaseModel):
    code: str
    severity: str
    message: str


class DestinationValidateResponse(BaseModel):
    path: str
    valid: bool
    checks: DestinationValidateChecks
    warnings: list[DestinationValidateWarning] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
