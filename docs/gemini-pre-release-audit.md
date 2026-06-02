# Gemini Pre-Release Audit — HardlinkOrganizer v1.0.0-rc.1

**Review date:** 2026-06-01
**Model:** Gemini 3.1 Pro (High)
**Scope:** Read-only quality audit; no code changes

---

## Summary

HardlinkOrganizer demonstrates a highly mature, defensively programmed architecture with excellent separation of concerns between its execution engine and web API. The system handles complex filesystem interactions—such as symlink resolution and cross-device edge cases—with precision. The most important class of issues found revolves around validation enforcement boundaries and database query optimization, where protective measures exist in the UI/API layer but are missing at the deeper core engine levels. With these minor structural and operational refinements, the application is highly robust.

---

## Findings

### [Security Posture] Unsafe destination root guard is bypassed by the core engine
**File:** `hardlink_organizer.py:675` (LinkPlan.is_valid)
**Severity:** High

The `_UNSAFE_DEST_ROOTS` list (protecting paths like `/boot` and `/etc`) is currently only evaluated in the `_validate_dest_path` feedback endpoint used by the UI in `webapp/app.py`. The core engine's `LinkPlan.is_valid()` does not enforce this restriction. A maliciously or accidentally configured `config.toml` (or an API call bypassing the UI) could successfully execute hardlinks directly into protected system directories.

**Recommendation:** Move the `_UNSAFE_DEST_ROOTS` check out of `webapp/app.py` and directly into `LinkPlan.is_valid()` in `hardlink_organizer.py` so it acts as an unbypassable guard at the engine level.

### [Database Layer] Missing secondary indexes for high-frequency queries
**File:** `engine/db.py:22` (Schema definition)
**Severity:** Medium

The SQLite schema creates tables without any secondary indexes. Queries such as `SELECT id FROM scans WHERE source_set = ? ORDER BY id DESC LIMIT 1` (used frequently in `get_latest_inventory`) and `SELECT * FROM inventory WHERE scan_id = ?` will perform full table scans. As scans and link histories accumulate over time, this will degrade performance and increase thread locking duration.

**Recommendation:** Add explicit `CREATE INDEX` statements for foreign keys and frequently filtered columns (e.g., `scan_id` on `inventory`, `source_set` on `scans` and `link_history`).

### [API Design] Inconsistent error response shapes
**File:** `webapp/app.py:371`
**Severity:** Low

The API exposes inconsistent error shapes to the frontend. Validation and execution endpoints return a structured body with an `errors: list[str]` property, while standard route exceptions (like 404 Not Found) and Pydantic validation errors (422) rely on FastAPI's default handlers, which return a `{"detail": "..."}` or `{"detail": [...]}` object. This forces frontend clients to handle multiple error schemas.

**Recommendation:** Implement a custom exception handler for `HTTPException` and `RequestValidationError` to normalize all API errors into a standard `{ "errors": [...] }` format.

### [Web Layer Architecture] Private symbol imported across module boundaries
**File:** `webapp/app.py:38`
**Severity:** Low

The web layer directly imports `_classify_mount_layout_path` from the core `hardlink_organizer` module. This is a private symbol, and importing it directly bypasses the intended public API boundary defined in `engine/__init__.py`.

**Recommendation:** Rename the function to remove the private prefix and export it cleanly through the `engine/__init__.py` public API surface.

### [Test Suite Quality] Execute tests assert on API response rather than disk state
**File:** `tests/test_webapp.py:467`
**Severity:** Low

The `test_execute_real_creates_hardlink` test verifies that the execute API returns `success=True` and `linked > 0`, but it does not inspect the filesystem to verify the link was actually created correctly (e.g., asserting `os.stat().st_nlink > 1` or matching inodes). This leaves a gap where the API could falsely report success without mutating the disk.

**Recommendation:** Add a direct filesystem assertion in the execute API tests to check the destination inode against the source inode, ensuring the API's reported success aligns with reality.

### [Security / Documentation] Missing network exposure warning for no-auth model
**File:** `README.md`
**Severity:** Low

The application is a locally-trusted, no-auth tool that can write to the filesystem. While the documentation mentions "local-first," there is no explicit warning advising operators against exposing the port (7700) to the public internet via reverse proxies.

**Recommendation:** Add a prominent security warning in the README and configuration docs detailing the no-auth model and explicitly discouraging public network exposure.

### [Frontend Code Quality] Implicit workflow state machine
**File:** `webapp/frontend/src/state/AppState.tsx:106`
**Severity:** Observation

The frontend workflow state machine is purely implicit. The `setStep` action allows arbitrary transitions between wizard steps without guarding against missing dependent state (e.g., navigating to `preview` without a valid `entry` or `destSubpath`). While individual components handle null states gracefully, the global state permits invalid permutations.

**Recommendation:** Implement explicit guard functions within `setStep` to enforce linear progression and require necessary context before allowing a step transition.

### [Observability] Startup banner bypasses configured logging framework
**File:** `webapp/run.py:70`
**Severity:** Observation

The application startup banner and configuration summary are written to `stdout` using standard `print()` calls rather than the configured `logging` framework. These critical startup details will be excluded from the `log_file` if one is configured, reducing debuggability for headless deployments.

**Recommendation:** Replace `print()` statements in `webapp/run.py` with `logger.info()` calls.

### [Dependency Hygiene] Loose dependency pinning risks build stability
**File:** `requirements.txt:4`
**Severity:** Observation

Python dependencies are specified with loose version ranges (e.g., `fastapi>=0.110.0`). For a stable production release, this risks upstream breaking changes automatically pulling into container builds and failing unexpectedly.

**Recommendation:** Pin exact versions in `requirements.txt` (e.g., `fastapi==0.110.0`) or introduce a lockfile mechanism for strictly reproducible builds.

---

## What is well-designed

- **File System Abstraction:** The `LinkPlan` pattern (`hardlink_organizer.py`) elegantly decouples path resolution, device boundary checks, and validation logic from the actual filesystem mutation, making the core safe and testable.
- **Robust Symlink Handling:** The test suite (`tests/test_hardlink_organizer.py`) and engine display careful attention to symlink edge cases, effectively using `os.lstat` to avoid mistakenly traversing or treating symlinks as actual files.
- **SQLite Concurrency Model:** `engine/db.py` uses a practical, clean solution to FastAPI thread-pooling limitations by employing a single shared connection with an `RLock` and WAL mode, preventing orphaned Windows file locks while remaining entirely thread-safe.
- **Granular Verification Engine:** `engine/verification.py` handles verification impeccably by treating only exact `st_ino` + `st_dev` matching as proof, while accurately categorizing complex failure states like cross-filesystem topologies and dangling symlinks.

---

## Release readiness verdict

HardlinkOrganizer is fundamentally sound, thoughtfully engineered, and effectively handles its core filesystem responsibilities safely. It is very close to being fully ready for a stable `v1.0.0` release. Before tagging the release, the `_UNSAFE_DEST_ROOTS` guard must be moved to the core engine to prevent potential system path tampering, and the database schema should be updated with the missing secondary indexes to guarantee long-term performance. Once these minor structural issues and the documentation warnings are addressed, the application will be exceptionally robust and fully production-ready.
