# HardlinkOrganizer v1.0.5 - Post-Release Comprehensive Audit

## 1. Post-v1.0.0 Hardlink Detection Correctness

*   **`check_already_linked` Behavior:** The function properly utilizes `st_nlink > 1` as an efficient and name-agnostic heuristic.
    *   **Empty Directories:** For an empty directory (or one containing only other empty directories), `check_already_linked` safely returns `False` because it only evaluates `st_nlink` on regular files (`entry.is_file(follow_symlinks=False)`).
    *   **Race Conditions:** There is a minor Time-Of-Check to Time-Of-Use (TOCTOU) window between `os.scandir` finding the file and `os.stat` resolving its inode metadata. However, this is safely handled by a catch-all `except OSError: return False` block, preventing unhandled exceptions if a file is deleted mid-scan.
*   **`_find_dest_inode_peers` Performance & Scalability:**
    *   **Complexity:** The two-level walk over every configured destination set is bounded to $O(\text{files in top 2 levels})$, but for a massive media library (e.g., 20,000 files), scanning and calling `os.stat` on every file until a match is found will be extremely slow.
    *   **Event Loop Blocking:** CRITICAL ISSUE. `_find_dest_inode_peers` invokes blocking filesystem I/O (`os.scandir`, `os.stat`) synchronously. Since it is called directly from the `async def get_inventory_detail` FastAPI route, it **blocks the main asyncio event loop**. This means a large library scan will freeze the entire web server for all requests until the filesystem walk completes. It must be wrapped in `run_in_threadpool`.
    *   **Deduplication:** The `seen_paths` logic deduplicates top-level directories successfully across different destination sets, preventing duplicate deep scans if two sets overlap.
    *   **Device ID Matching:** The `st.st_dev == device_id` check is necessary and correct. Nested mount points could theoretically have overlapping inode numbers on different filesystems; this check prevents false positive peer matching.
    *   **`InodePeer.id` Sentinel:** Assigning `None` to `id` for live-scanned peers is safe. The frontend handles this gracefully in `HistorySidebar.tsx` by falling back to array indices (`peer.id ?? 'dest-${idx}'`).

## 2. API Design and REST Semantics

*   **URL Structure:** The implementation diverges slightly from the prompt's `GET /api/inventory/{source_set}/{entry_id}/detail` design, instead using `GET /api/inventory/detail?source_set=...&full_path=...`. This is actually a **safer and better design**, as it inherently avoids the H-1 path-stability bugs that arise from positional array IDs.
*   **Error Responses:** Exceptions are cleanly caught by FastAPI's `HTTPException` and `RequestValidationError` handlers, yielding standard, easily digestible JSON shapes for the frontend.
*   **Response Extensibility:** The addition of the `already_linked` boolean flag to the existing inventory responses avoids breaking existing consumers while fulfilling the frontend's needs.

## 3. Database Layer (`engine/db.py`)

*   **Concurrency:** The `sqlite3.Connection` protected by `threading.RLock` works adequately for single-user workloads. However, note that calling synchronous DB methods from `async def` FastAPI routes will also block the asyncio event loop.
*   **Missing Indexes:** There are notable index deficiencies that will cause severe full table scans as the library grows:
    1.  `link_history(full_path, dry_run, linked_count)`: Without this index, `get_link_status` must scan the entire history table to evaluate the batch of 900 `IN (...)` paths.
    2.  `inventory(inode, device_id)`: Without this index, the query in `get_inode_peers` executes a full table scan across the entire inventory database on every detail click.
*   **SQL Injection Guard:** `update_destination` utilizes a strict Python `set` whitelist (`_allowed`) before executing a parameterized `UPDATE` query. This completely nullifies SQL injection vectors.

## 4. Core Engine

*   **Path Traversal Prevention:** `LinkPlan.is_valid()` prevents `../` traversal escapes flawlessly by executing `.resolve().relative_to(resolved_root)`. This correctly identifies when a crafted `dest_subpath` resolves to an outer path on the disk.
*   **TOCTOU in Execution:** `execute_link_plan` faces a natural TOCTOU between the `is_valid()` checks and `os.link`. However, since `os.link` guarantees atomic link creation and fails natively if the destination already exists (without overwriting), the operation remains secure.
*   **Type Safety:** There is a minor Typing inconsistency. `scan_source_set` injects `"inode": inode` into the dictionary, but the `InventoryEntry` `TypedDict` definition in `hardlink_organizer.py` does not declare `inode: int | None`. This will fail strict static analysis tools like `mypy`.

## 5. Pending Feature Prompt Assessment

**CRITICAL FINDING: BOTH provided agent prompts have already been implemented.**

1.  **`AGENT_PROMPT_file_entry_subfolder.md`**: The `_extract_clean_title` function, the modifications to `suggest_destination_name(entry_type="file")`, and the frontend changes for editable folder names on file entries are already fully integrated in `hardlink_organizer.py` and `PreviewStep.tsx`.
2.  **`AGENT_PROMPT_nlink_refine.md`**: The exact nlink refactoring (removing `dest_root` and returning `st_nlink > 1`) exists in `check_already_linked`.

**Recommendation:** Do not run these prompts. They are 100% redundant and execution will only confuse the agent or duplicate existing functions.

## 6. Web Layer Architecture

*   **State / Dependency Injection:** The configuration (`cfg`) and database singleton (`db`) are injected cleanly via `request.app.state`, ensuring consistent referencing across the web layer without module-level globals.
*   **Pydantic Models:** The definitions in `webapp/models.py` successfully declare the schemas for `InodePeer` and `InventoryDetailResponse`.

## 7. Security Posture

*   **Unvalidated Arbitrary File Stat Risk:** The `GET /api/inventory/detail` endpoint takes an unvalidated `full_path` string and immediately executes `src = Path(full_path); st = src.stat()`. While `scandir` is not exploited here, a user (or rogue actor who accesses the no-auth UI) can supply any absolute path (e.g., `/etc/shadow`) and retrieve its inode and link counts. In a locally trusted environment this is low risk, but ideally, `full_path` should be validated to ensure it falls within the directory mapped by `c["source_sets"][source_set]`.

## 8. Test Suite Quality

*   `check_already_linked` has robust test coverage ensuring accurate detection logic for both individual files and nested subdirectories.
*   `_find_dest_inode_peers` **lacks any unit testing** in `tests/test_webapp.py`. Due to its performance constraints and complexity, adding mocked filesystem tests for this method is highly advised.

## 9. Frontend Integration

*   **`BrowseStep.tsx` Drilldown:** The "Linked (disk)" badge logic correctly surfaces external system hardlinks, driving user discovery through `detailEntry`.
*   **Data Freshness:** Clicking the badge immediately triggers a network fetch (`api.getInventoryDetail`), avoiding stale data caching and ensuring the user views the live inode state.

## 10. Summary and Next Steps

The release is largely stable, safe, and operates correctly for its primary purpose. 
**Immediate Maintenance Items for Next Session:**
1.  Wrap the blocking `_find_dest_inode_peers` function call in `get_inventory_detail` with FastAPI's `run_in_threadpool` to prevent the web server from hanging on large directories.
2.  Add SQLite indices on `inventory(inode, device_id)` and `link_history(full_path, dry_run, linked_count)`.
3.  Add `inode: int | None` to the `InventoryEntry` TypedDict definition.
4.  Secure `get_inventory_detail` by ensuring `full_path` is a child of the `source_set` root.
5.  Discard the provided agent prompts as they have already been merged.
