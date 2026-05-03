"""
FastAPI application for the Hardlink Organizer web interface.

Create the app with create_app(cfg, db, config_path) rather than importing
a module-level 'app' directly — this keeps the app testable with arbitrary
config and database instances.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Ensure tool root is on path (engine package lives there).
_TOOL_DIR = Path(__file__).resolve().parent.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
import csv
import io

from engine import (
    __version__,
    Config,
    scan_source_set,
    scan_all_sets,
    list_entries,
    build_link_plan,
    execute_link_plan,
    suggest_destination_name,
    ScanError,
    ConfigError,
)
from hardlink_organizer import _classify_mount_layout_path
from engine.db import Database
from engine.verification import run_verification_for_link_history
from webapp.models import (
    SetsWithStatusResponse,
    ScanSummary,
    ScanRequest,
    ScanResponse,
    InventoryResponse,
    InventoryEntry as InventoryEntryModel,
    PreviewRequest,
    PreviewResponse,
    ExecuteRequest,
    ExecuteResponse,
    HistoryEntry,
    HistoryResponse,
    HealthResponse,
    VerifyRequest,
    VerificationResultItem,
    VerificationRunResponse,
    DestinationCreate,
    DestinationUpdate,
    DestinationEntry,
    DestinationListResponse,
    DestinationValidateRequest,
    DestinationValidateChecks,
    DestinationValidateWarning,
    DestinationValidateResponse,
)

_TEMPLATES_DIR = Path(__file__).parent / "templates"
_STATIC_DIR = Path(__file__).parent / "static"

# Paths that must never be accepted as a managed destination.
_UNSAFE_DEST_ROOTS = frozenset({
    "/",
    "/bin", "/boot", "/config", "/data", "/dev",
    "/etc", "/lib", "/lib64", "/proc", "/root",
    "/run", "/sbin", "/sys", "/usr", "/var",
})


def _validate_dest_path(path: str) -> DestinationValidateResponse:
    """Run safety checks on a candidate destination path and return structured results."""
    normalized = os.path.normpath(path)

    exists = os.path.exists(normalized)
    is_directory = os.path.isdir(normalized) if exists else False
    is_writable: bool | None = os.access(normalized, os.W_OK) if exists else None
    is_unsafe_root = normalized in _UNSAFE_DEST_ROOTS

    errors: list[str] = []
    warnings: list[DestinationValidateWarning] = []

    if not exists:
        errors.append(f"Path does not exist: {normalized!r}")
    elif not is_directory:
        errors.append(f"Path is not a directory: {normalized!r}")

    if is_unsafe_root:
        errors.append(
            f"Path {normalized!r} is a system or reserved root and cannot be used as a destination."
        )

    if exists and is_directory and is_writable is False:
        warnings.append(DestinationValidateWarning(
            code="not_writable",
            severity="warn",
            message=f"Path {normalized!r} is not writable by the current process.",
        ))

    path_kind = _classify_mount_layout_path(normalized)
    if path_kind == "user_share":
        warnings.append(DestinationValidateWarning(
            code="unraid_user_share",
            severity="warn",
            message=(
                "This path is under /mnt/user, which is Unraid's share-style virtual mount. "
                "Hardlinks to this destination may still fail with EXDEV at execution time even "
                "when preview passes. Prefer a disk-level mount such as /mnt/disk3/..."
            ),
        ))
    elif path_kind == "mergerfs_pool":
        warnings.append(DestinationValidateWarning(
            code="mergerfs_pool_path",
            severity="warn",
            message=(
                "This path is under a MergerFS pool mount (/srv/mergerfs/). Like Unraid's "
                "/mnt/user, pool mounts can hide the underlying device layout and cause EXDEV "
                "failures. Prefer a direct disk path for reliable hardlinks."
            ),
        ))

    valid = exists and is_directory and not is_unsafe_root

    return DestinationValidateResponse(
        path=normalized,
        valid=valid,
        checks=DestinationValidateChecks(
            exists=exists,
            is_directory=is_directory,
            is_writable=is_writable,
            is_unsafe_root=is_unsafe_root,
        ),
        warnings=warnings,
        errors=errors,
    )


def create_app(cfg: Config, db: Database, config_path: str) -> FastAPI:
    """
    Factory that creates and wires the FastAPI application.

    Parameters
    ----------
    cfg:         Loaded tool configuration dict.
    db:          Initialised Database instance.
    config_path: Path to the config file (for display purposes).
    """
    app = FastAPI(
        title="Hardlink Organizer",
        version=__version__,
        docs_url="/api/docs",
        redoc_url=None,
    )

    # Store shared state on the app object so route handlers can reach it.
    app.state.cfg = cfg
    app.state.db = db
    app.state.config_path = config_path

    templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    # -----------------------------------------------------------------------
    # UI route
    # -----------------------------------------------------------------------

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def index(request: Request):
        c: Config = request.app.state.cfg
        d: Database = request.app.state.db

        source_summaries: dict[str, dict] = {}
        for name in c["source_sets"]:
            summary = d.get_scan_summary(name)
            source_summaries[name] = summary or {}

        sets_payload = {
            "source_sets": c["source_sets"],
            "dest_sets": c["dest_sets"],
        }

        return templates.TemplateResponse(
            request=request,
            name="index.html",
            context={
                "version": __version__,
                "sets_json": json.dumps(sets_payload),
                "summaries_json": json.dumps(source_summaries),
            },
        )

    # -----------------------------------------------------------------------
    # Health
    # -----------------------------------------------------------------------

    @app.get("/health", response_model=HealthResponse)
    async def health(request: Request):
        d: Database = request.app.state.db
        return HealthResponse(
            status="ok",
            version=__version__,
            config_loaded=True,
            db_path=str(d._path),
        )

    # -----------------------------------------------------------------------
    # Config / Sets
    # -----------------------------------------------------------------------

    @app.get("/api/config/sets", response_model=SetsWithStatusResponse)
    async def get_sets(request: Request):
        c: Config = request.app.state.cfg
        d: Database = request.app.state.db

        summaries: dict[str, ScanSummary] = {}
        for name in c["source_sets"]:
            row = d.get_scan_summary(name)
            summaries[name] = ScanSummary(
                source_set=name,
                scan_time=row["scan_time"] if row else None,
                entry_count=row["entry_count"] if row else None,
            )

        return SetsWithStatusResponse(
            source_sets=c["source_sets"],
            dest_sets=c["dest_sets"],
            scan_summaries=summaries,
        )

    # -----------------------------------------------------------------------
    # Scan
    # -----------------------------------------------------------------------

    @app.post("/api/scan", response_model=ScanResponse)
    async def trigger_scan(request: Request, body: ScanRequest):
        c: Config = request.app.state.cfg
        d: Database = request.app.state.db

        include_hidden = c["settings"].get("include_hidden", False)
        source_sets = c["source_sets"]

        sets_to_scan: dict[str, str] = {}
        if body.source_set:
            if body.source_set not in source_sets:
                raise HTTPException(
                    status_code=404,
                    detail=f"Source set {body.source_set!r} not found in config.",
                )
            sets_to_scan = {body.source_set: source_sets[body.source_set]}
        else:
            sets_to_scan = source_sets

        per_set: dict[str, int] = {}
        for name, root in sets_to_scan.items():
            entries = scan_source_set(name, root, include_hidden=include_hidden)
            if entries:
                scan_time = entries[0]["scan_time"]
            else:
                scan_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            d.record_scan(name, scan_time, entries)
            per_set[name] = len(entries)

        return ScanResponse(
            scanned_sets=list(sets_to_scan.keys()),
            total_entries=sum(per_set.values()),
            per_set=per_set,
        )

    # -----------------------------------------------------------------------
    # Inventory
    # -----------------------------------------------------------------------

    @app.get("/api/inventory", response_model=InventoryResponse)
    async def get_inventory(request: Request, source_set: str, live: bool = False):
        c: Config = request.app.state.cfg
        d: Database = request.app.state.db

        if source_set not in c["source_sets"]:
            raise HTTPException(
                status_code=404,
                detail=f"Source set {source_set!r} not found in config.",
            )

        from_db = False
        scan_time: str | None = None

        if not live:
            db_entries = d.get_latest_inventory(source_set)
            if db_entries:
                raw_entries = db_entries
                from_db = True
                scan_time = db_entries[0].get("scan_time") if db_entries else None

        if not from_db:
            include_hidden = c["settings"].get("include_hidden", False)
            raw_entries = scan_source_set(
                source_set, c["source_sets"][source_set], include_hidden=include_hidden
            )
            for idx, e in enumerate(raw_entries, start=1):
                e["id"] = idx
            scan_time = raw_entries[0]["scan_time"] if raw_entries else None

        # Annotate with link history
        paths = [e["full_path"] for e in raw_entries]
        link_status = d.get_link_status(paths)

        entries = [
            InventoryEntryModel(
                id=e["id"],
                source_set=e["source_set"],
                entry_type=e["entry_type"],
                display_name=e["display_name"],
                real_name=e["real_name"],
                full_path=e["full_path"],
                scan_time=e.get("scan_time", ""),
                size_bytes=e.get("size_bytes", 0),
                device_id=e.get("device_id", 0),
                linked=link_status.get(e["full_path"], False),
            )
            for e in raw_entries
        ]

        return InventoryResponse(
            source_set=source_set,
            entries=entries,
            scan_time=scan_time,
            from_db=from_db,
        )

    # -----------------------------------------------------------------------
    # Preview
    # -----------------------------------------------------------------------

    @app.post("/api/preview", response_model=PreviewResponse)
    async def preview(request: Request, body: PreviewRequest):
        c: Config = request.app.state.cfg
        d: Database = request.app.state.db

        if body.source_set not in c["source_sets"]:
            raise HTTPException(404, f"Source set {body.source_set!r} not found.")
        if body.dest_set not in c["dest_sets"]:
            raise HTTPException(404, f"Dest set {body.dest_set!r} not found.")

        # Resolve the entry from DB inventory (fall back to live scan)
        db_entries = d.get_latest_inventory(body.source_set)
        if db_entries:
            matched = [e for e in db_entries if e["id"] == body.entry_id]
        else:
            include_hidden = c["settings"].get("include_hidden", False)
            live = scan_source_set(
                body.source_set,
                c["source_sets"][body.source_set],
                include_hidden=include_hidden,
            )
            matched = [e for e in live if e["id"] == body.entry_id]

        if not matched:
            raise HTTPException(404, f"Entry {body.entry_id} not found in {body.source_set!r}.")

        entry = matched[0]
        dest_root = c["dest_sets"][body.dest_set]
        dest_subpath = body.dest_subpath or suggest_destination_name(entry["display_name"])

        plan = build_link_plan(entry, dest_root, dest_subpath)
        ok, errors = plan.is_valid()

        previously_linked = d.is_linked(entry["full_path"])

        return PreviewResponse(
            source_set=body.source_set,
            real_name=entry["real_name"],
            display_name=entry["display_name"],
            entry_type=entry["entry_type"],
            source_path=entry["full_path"],
            dest_set=body.dest_set,
            dest_root=dest_root,
            dest_subpath=dest_subpath,
            dest_full=plan.dest_full,
            valid=ok,
            errors=errors,
            warnings=plan.warnings,
            previously_linked=previously_linked,
        )

    # -----------------------------------------------------------------------
    # Execute
    # -----------------------------------------------------------------------

    @app.post("/api/execute", response_model=ExecuteResponse)
    async def execute(request: Request, body: ExecuteRequest):
        c: Config = request.app.state.cfg
        d: Database = request.app.state.db

        if body.source_set not in c["source_sets"]:
            raise HTTPException(404, f"Source set {body.source_set!r} not found.")
        if body.dest_set not in c["dest_sets"]:
            raise HTTPException(404, f"Dest set {body.dest_set!r} not found.")

        # Resolve entry
        db_entries = d.get_latest_inventory(body.source_set)
        if db_entries:
            matched = [e for e in db_entries if e["id"] == body.entry_id]
        else:
            include_hidden = c["settings"].get("include_hidden", False)
            live = scan_source_set(
                body.source_set,
                c["source_sets"][body.source_set],
                include_hidden=include_hidden,
            )
            matched = [e for e in live if e["id"] == body.entry_id]

        if not matched:
            raise HTTPException(404, f"Entry {body.entry_id} not found.")

        entry = matched[0]
        dest_root = c["dest_sets"][body.dest_set]

        plan = build_link_plan(entry, dest_root, body.dest_subpath)
        ok, errors = plan.is_valid()

        if not ok:
            return ExecuteResponse(
                success=False,
                dry_run=body.dry_run,
                linked=0,
                skipped=0,
                failed=0,
                linked_files=[],
                skipped_files=[],
                failed_files=[],
                errors=errors,
            )

        result = execute_link_plan(plan, dry_run=body.dry_run)
        if result is None:
            return ExecuteResponse(
                success=False,
                dry_run=body.dry_run,
                linked=0,
                skipped=0,
                failed=0,
                linked_files=[],
                skipped_files=[],
                failed_files=[],
                errors=["Execution failed before any files were processed."],
            )

        linked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        history_id = d.record_link(
            source_set=body.source_set,
            real_name=entry["real_name"],
            full_path=entry["full_path"],
            dest_set=body.dest_set,
            dest_root=dest_root,
            dest_subpath=plan.dest_subpath,
            dest_full=plan.dest_full,
            linked_count=len(result.linked),
            skipped_count=len(result.skipped),
            failed_count=len(result.failed),
            dry_run=body.dry_run,
            linked_at=linked_at,
        )

        return ExecuteResponse(
            success=len(result.failed) == 0,
            dry_run=body.dry_run,
            linked=len(result.linked),
            skipped=len(result.skipped),
            failed=len(result.failed),
            linked_files=result.linked,
            skipped_files=result.skipped,
            failed_files=result.failed,
            errors=[],
            history_id=history_id,
        )

    # -----------------------------------------------------------------------
    # History
    # -----------------------------------------------------------------------

    @app.get("/api/history", response_model=HistoryResponse)
    async def get_history(
        request: Request,
        source_set: str | None = None,
        limit: int = 50,
    ):
        d: Database = request.app.state.db
        rows = d.get_history(limit=limit, source_set=source_set)
        history = [
            HistoryEntry(
                id=r["id"],
                source_set=r["source_set"],
                real_name=r["real_name"],
                full_path=r["full_path"],
                dest_set=r["dest_set"],
                dest_root=r["dest_root"],
                dest_subpath=r["dest_subpath"],
                dest_full=r["dest_full"],
                linked_count=r["linked_count"],
                skipped_count=r["skipped_count"],
                failed_count=r["failed_count"],
                dry_run=bool(r["dry_run"]),
                linked_at=r["linked_at"],
                notes=r.get("notes"),
            )
            for r in rows
        ]
        return HistoryResponse(history=history, total=len(history))

    # -----------------------------------------------------------------------
    # Verification
    # -----------------------------------------------------------------------

    @app.post("/api/verify")
    def trigger_verify(request: Request, body: VerifyRequest):
        d: Database = request.app.state.db

        if body.mode != "link_history":
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported verification mode: {body.mode!r}. "
                       "Only 'link_history' is accepted in this version.",
            )

        # Look up the link history record
        history_record = d.get_link_history_record(body.link_history_id)
        if not history_record:
            raise HTTPException(
                status_code=404,
                detail=f"link_history record {body.link_history_id} not found.",
            )

        run_id = run_verification_for_link_history(db=d, history_record=history_record)
        return JSONResponse(content={"run_id": run_id})

    @app.get("/api/verify/{run_id}", response_model=VerificationRunResponse)
    async def get_verify_run(request: Request, run_id: int):
        d: Database = request.app.state.db
        run = d.get_verification_run(run_id)
        if run is None:
            raise HTTPException(
                status_code=404,
                detail=f"Verification run {run_id} not found.",
            )

        results = [
            VerificationResultItem(
                id=r["id"],
                source_path=r["source_path"],
                candidate_dest=r["candidate_dest"],
                source_dev=r.get("source_dev"),
                source_inode=r.get("source_inode"),
                source_nlink=r.get("source_nlink"),
                dest_dev=r.get("dest_dev"),
                dest_inode=r.get("dest_inode"),
                dest_nlink=r.get("dest_nlink"),
                status=r["status"],
                notes=r.get("notes"),
            )
            for r in run["results"]
        ]
        return VerificationRunResponse(
            run_id=run["id"],
            created_at=run["created_at"],
            mode=run["mode"],
            source_set=run.get("source_set"),
            dest_set=run.get("dest_set"),
            link_history_id=run.get("link_history_id"),
            verified_count=run["verified_count"],
            failed_count=run["failed_count"],
            missing_count=run["missing_count"],
            error_count=run["error_count"],
            notes=run.get("notes"),
            results=results,
        )

    @app.get("/api/verify/{run_id}/export.json")
    async def get_verify_export_json(request: Request, run_id: int):
        d: Database = request.app.state.db
        run = d.get_verification_run(run_id)
        if run is None:
            raise HTTPException(
                status_code=404,
                detail=f"Verification run {run_id} not found.",
            )
        return JSONResponse(content=run)

    @app.get("/api/verify/{run_id}/export.csv")
    async def get_verify_export_csv(request: Request, run_id: int):
        d: Database = request.app.state.db
        run = d.get_verification_run(run_id)
        if run is None:
            raise HTTPException(
                status_code=404,
                detail=f"Verification run {run_id} not found.",
            )

        output = io.StringIO()
        fieldnames = [
            "status", "notes", "source_path", "candidate_dest",
            "source_dev", "source_inode", "source_nlink",
            "dest_dev", "dest_inode", "dest_nlink"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()

        for result in run["results"]:
            row = {
                "status": result.get("status", ""),
                "notes": result.get("notes", ""),
                "source_path": result.get("source_path", ""),
                "candidate_dest": result.get("candidate_dest", ""),
                "source_dev": result.get("source_dev", ""),
                "source_inode": result.get("source_inode", ""),
                "source_nlink": result.get("source_nlink", ""),
                "dest_dev": result.get("dest_dev", ""),
                "dest_inode": result.get("dest_inode", ""),
                "dest_nlink": result.get("dest_nlink", ""),
            }
            # Replace None with empty string for CSV readability
            row = {k: (v if v is not None else "") for k, v in row.items()}
            writer.writerow(row)

        return PlainTextResponse(
            content=output.getvalue(),
            headers={"Content-Disposition": f'attachment; filename="verification_run_{run_id}.csv"'},
            media_type="text/csv",
        )

    # -----------------------------------------------------------------------
    # Destination registry
    # -----------------------------------------------------------------------

    @app.get("/api/destinations", response_model=DestinationListResponse)
    async def list_destinations(request: Request):
        d: Database = request.app.state.db
        rows = d.list_destinations()
        destinations = [
            DestinationEntry(
                id=r["id"],
                label=r["label"],
                path=r["path"],
                tag=r.get("tag"),
                enabled=bool(r["enabled"]),
                notes=r.get("notes"),
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
            for r in rows
        ]
        return DestinationListResponse(destinations=destinations, total=len(destinations))

    @app.post("/api/destinations/validate", response_model=DestinationValidateResponse)
    async def validate_destination(request: Request, body: DestinationValidateRequest):
        return _validate_dest_path(body.path)

    @app.post("/api/destinations", response_model=DestinationEntry, status_code=201)
    async def create_destination(request: Request, body: DestinationCreate):
        d: Database = request.app.state.db
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        try:
            dest_id = d.add_destination(
                label=body.label,
                path=body.path,
                tag=body.tag,
                enabled=body.enabled,
                notes=body.notes,
                created_at=now,
                updated_at=now,
            )
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(
                    status_code=409,
                    detail=f"A destination with path {body.path!r} already exists.",
                )
            raise
        row = d.get_destination(dest_id)
        return DestinationEntry(
            id=row["id"],
            label=row["label"],
            path=row["path"],
            tag=row.get("tag"),
            enabled=bool(row["enabled"]),
            notes=row.get("notes"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @app.patch("/api/destinations/{dest_id}", response_model=DestinationEntry)
    async def update_destination(request: Request, dest_id: int, body: DestinationUpdate):
        d: Database = request.app.state.db
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        patch: dict = {k: v for k, v in body.model_dump().items() if v is not None}
        patch["updated_at"] = now
        updated = d.update_destination(dest_id, **patch)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Destination {dest_id} not found.")
        row = d.get_destination(dest_id)
        return DestinationEntry(
            id=row["id"],
            label=row["label"],
            path=row["path"],
            tag=row.get("tag"),
            enabled=bool(row["enabled"]),
            notes=row.get("notes"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @app.delete("/api/destinations/{dest_id}", status_code=204)
    async def delete_destination(request: Request, dest_id: int):
        d: Database = request.app.state.db
        deleted = d.delete_destination(dest_id)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Destination {dest_id} not found.")

    return app
