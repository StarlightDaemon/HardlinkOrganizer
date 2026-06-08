# Prompt 82: Post-Release Comprehensive Audit (Read-Only)

**Target model:** Gemini 3 Pro

**Mode:** Read-only review. No code changes. No edits. No commits.
Your output is a structured feedback report saved as a markdown file.

---

## What this project is

**HardlinkOrganizer** is a Python/FastAPI tool with a React SPA frontend for
safely planning and executing hardlinks across NAS storage pools. Operators
use it to reorganize media libraries (films, TV, etc.) by hardlinking files
from source directories into destination library structures, preserving disk
space since hardlinks share the same underlying data blocks.

The intended deployment is a Docker container on a NAS (Unraid, TrueNAS, OMV),
or a local Linux install. It is a single-user, locally-trusted tool with no
authentication layer — all API callers are assumed to be the operator.

**Version:** `1.0.5` (stable, post-release)

---

## Repository root

`/Users/dante/Citadel/HardlinkOrganizer`

---

## What has already been reviewed and fixed

These findings are closed. Do NOT re-report them:

| ID | What was fixed |
|---|---|
| C-1 | `hardlink_tree`/`hardlink_file` now skip symlinks via `os.lstat` |
| C-2 | Default DB path changed to `/config/hardlink-organizer.db` |
| H-1 | Inventory resolved by `full_path` instead of positional ID |
| H-2 | `ExecuteRequest.dest_subpath` is `str \| None`; fallback explicit in route |
| M-1 | `webapp/run.py` reads `HARDLINK_CONFIG` env var |
| M-2 | PATCH destinations uses `model_dump(exclude_unset=True)` |
| L-1 | Unused `jinja2` removed from `requirements.txt` |
| L-2 | `/health` returns `db_connected: bool` instead of exposing `db_path` |
| L-3 | `/tmp` and `/var/tmp` added to `_UNSAFE_DEST_ROOTS` |
| L-4 | `ExecuteResponse` includes `any_linked: bool` |
| path-traversal | `LinkPlan.is_valid()` blocks `dest_subpath` traversal via `Path.relative_to()` |
| collision-warn | `hardlink_file()` warns on collision instead of silent skip |
| chunk-query | `get_link_status()` chunked to avoid SQLite 999-variable limit |
| nlink-detect | `check_already_linked` replaced name-match with `st_nlink > 1` heuristic |
| nlink-peers | `_find_dest_inode_peers` added to `app.py`; `InodePeer` / `InventoryDetailResponse` models added |

---

## The v1.0.x feature delta (context for the audit)

Between v1.0.0 and v1.0.5, these features shipped. They have not been independently audited and are a primary focus of this review:

1. **Filesystem-based hardlink detection** (`check_already_linked`, `st_nlink > 1`) — added in `a98f377`, refined in `8c295ea` and `26deeb3`. Now exposed in the Browse inventory as an `already_linked` field.

2. **Inode detail panel and hardlink peer grouping** — `_find_dest_inode_peers` in `webapp/app.py` (new `GET /api/inventory/{source_set}/{entry_id}/detail` endpoint). Scans configured `dest_sets` for inode peers matching the selected entry. Two-level walk within each dest root.

3. **Browse filter split** — the single "linked" toggle in BrowseStep was split into two independent toggles: HLO-linked (via link history DB) and disk-linked (via `already_linked` field). Added `26deeb3`.

4. **Link detail panel moved to workflow sidebar** — was inline in the workflow; now rendered in the sidebar alongside history. Added `38da655`.

5. **Two pending feature prompts (not yet implemented)** — two agent-prompt files exist at `packaging/unraid/` that describe upcoming work but have not been merged yet:
   - `AGENT_PROMPT_file_entry_subfolder.md` — file-entry subfolder wrapping for Radarr-compatible linking (new `_extract_clean_title` helper, updated `suggest_destination_name`, editable folder name in PreviewStep)
   - `AGENT_PROMPT_nlink_refine.md` — removes `dest_root` from `check_already_linked` call sites and cleans up `app.py`

---

## Your task

Read the codebase and produce a **post-release quality audit**. The correctness
issues listed above are resolved. You are looking at:

- **Post-v1.0.0 feature correctness** — do the new hardlink detection and inode
  peer features work correctly at the boundaries?
- **Code quality and internal consistency** across all layers
- **API design and REST semantics**
- **Architecture and layer boundaries**
- **Security posture** (no-auth deployment model)
- **Test suite quality** — coverage of the new features in particular
- **Frontend state management and UX correctness**
- **Pending feature readiness** — are the two unimplemented prompts
  (`AGENT_PROMPT_file_entry_subfolder.md`, `AGENT_PROMPT_nlink_refine.md`)
  safe to execute as written, or do they have issues that should be corrected
  before the agent runs them?

Be direct and specific. Name the file, line, and concrete consequence.
If something is well-designed, say so briefly. Do not omit dimensions.

---

## Review dimensions

Work through each dimension. Note clean dimensions as such rather than omitting them.

### 1. Post-v1.0.0 hardlink detection correctness

Read `hardlink_organizer.py` focusing on `check_already_linked`. Read the
`_find_dest_inode_peers` helper in `webapp/app.py` (around line 149).

- `check_already_linked` uses `st_nlink > 1` on the first file found in a
  directory. What happens for a source entry that is a single empty directory,
  or a directory whose only content is another subdirectory? Does the two-level
  scandir catch all relevant file positions?
- Is there a race window in `check_already_linked` between the `scandir` walk
  and the `os.stat` call on the found file?
- `_find_dest_inode_peers` scans every configured `dest_set` on the same device.
  For a library with many top-level entries and multiple dest sets, is the
  two-level walk bounded? Could it be slow enough to cause a timeout on a large
  library?
- The function uses `seen_paths` to deduplicate at the `top_path` level. For a
  multi-file directory where two different files match the inode, is the
  deduplication correct — is `top_path` added to `seen_paths` inside the
  `sub_it` loop before breaking?
- The inode match uses `st.st_ino == inode and st.st_dev == device_id`. Is the
  device check necessary given the earlier `root_dev != device_id` filter on
  dest_root, or is it redundant? If redundant, is it harmless?
- `InodePeer.id` is always `None`. What does this field mean to the frontend, and
  is `None` the right sentinel?

### 2. API design and REST semantics

Read all routes in `webapp/app.py`. Check for:
- The new `GET /api/inventory/{source_set}/{entry_id}/detail` endpoint — is the
  URL structure consistent with how other inventory endpoints are named? Does
  `entry_id` resolve correctly, or is there a risk of the same path-stability
  issues that required the H-1 fix?
- HTTP method choices — any POST used where GET or PUT would be appropriate?
- Status code correctness — 201 for creates, 204 for deletes, correct 404/422/409
  usage throughout; check the new detail endpoint specifically
- Whether the new `check_already_linked` result in the inventory response changes
  the shape of `InventoryEntry` in a way that breaks existing clients
- Whether `_find_dest_inode_peers` is invoked synchronously in a FastAPI route
  and whether that is appropriate for a potentially slow filesystem scan
- Error response shapes — does every error path return a structured body?

### 3. Database layer

Read `engine/db.py` in full. Check for:
- Whether the single shared `sqlite3.Connection` with `threading.RLock` is
  sufficient under FastAPI's async/threading model, or whether it creates
  contention under the new peer-scan workload
- Whether `_init_schema` creates appropriate indexes for the queries that run,
  including the `get_link_status` chunked query path
- Whether the `update_destination` `**fields` pattern with the `_allowed`
  whitelist fully prevents SQL injection
- Error handling: what happens if `_conn()` is called after `close()`?
- Any N+1 queries or unparameterized inputs in the post-v1.0.0 additions

### 4. Core engine — hardlink_organizer.py

Read the public API surface: `scan_source_set`, `build_link_plan`,
`execute_link_plan`, `hardlink_file`, `hardlink_tree`, `check_already_linked`,
`generate_display_name`, `suggest_destination_name`. Check for:
- Whether `LinkPlan.is_valid()` path-traversal guard is robust when `dest_root`
  itself is a symlink
- Whether `execute_link_plan` has any TOCTOU window between validation and
  the `os.link` call
- Whether `check_already_linked` is exported correctly from `engine/__init__.py`
  now that `webapp/app.py` imports it directly
- The `TypedDict` usage for `InventoryEntry` and `Config` — are all new call
  sites added in v1.0.x type-safe?
- `generate_display_name` is now exported and called in `_find_dest_inode_peers`
  — was it previously only an internal helper? Does its contract match this usage?

### 5. Pending feature prompt review

Read `packaging/unraid/AGENT_PROMPT_file_entry_subfolder.md` and
`packaging/unraid/AGENT_PROMPT_nlink_refine.md` in full. For each:

- Is the problem statement accurate against the current codebase?
- Are the exact line numbers and function signatures cited in the prompt still
  correct (the codebase has changed since these prompts were written)?
- Are there any steps that would break existing tests?
- Are there any steps that introduce new correctness or security issues?
- Are there any missing steps (things the prompt says "won't change" but actually
  need to change for the feature to work)?
- Are there any steps that could conflict with each other if both prompts are
  run sequentially without intermediate review?

For `AGENT_PROMPT_nlink_refine.md` specifically: the prompt says to remove
`dest_root` from `check_already_linked`. Verify that `check_already_linked`
in the current codebase does or does not already have this signature — the
nlink heuristic may have already been applied, making this prompt a no-op
or partially redundant.

### 6. Web layer architecture

Read `webapp/app.py` and `webapp/models.py`. Check for:
- Whether all routes consistently use `request.app.state.cfg` and
  `request.app.state.db`, or whether some reach for globals
- Whether `_find_dest_inode_peers` takes `cfg` as a parameter (correct) or
  reaches for module-level state (incorrect)
- Whether `InodePeer` and `InventoryDetailResponse` are correctly placed in
  `webapp/models.py` or scattered elsewhere
- Pydantic v2 correctness: any use of deprecated v1 patterns
- Whether request validation errors (422) have useful messages

### 7. Security posture

This is a no-auth, locally-trusted tool. Check:
- Whether `_find_dest_inode_peers` accepts any user-controlled path strings
  that feed directly into `os.scandir` or `os.stat`; if so, is the device
  check sufficient sanitization, or could a symlinked dest_root escape the
  intended scan scope?
- Whether the new `entry_id` parameter in the detail route is used in file I/O
  after lookup, or whether it only performs a DB/config lookup (safer)
- Whether any new routes accept user-controlled strings used in file I/O
  without the `_UNSAFE_DEST_ROOTS` / `is_valid()` guards
- The no-auth model: is it documented in README and config docs?

### 8. Test suite quality

Read `tests/test_webapp.py`, `tests/test_hardlink_organizer.py`,
`tests/test_engine_db.py`, and `tests/test_verification.py`. Check:
- Is `check_already_linked` with the nlink heuristic tested against real
  `os.link` calls on actual temp filesystem paths, or mocked?
- Is `_find_dest_inode_peers` tested at all? What edge cases would be valuable:
  empty dest root, dest root on a different device, the inode present in
  multiple dest sets?
- Are the new Browse filter states (HLO-linked vs disk-linked) exercised in
  the webapp tests?
- Are unhappy paths tested for the new `GET .../detail` endpoint (404 when
  source set does not exist, 404 when entry_id is unknown)?
- Does `test_execute_*` assert on hardlink correctness via `st_nlink` or only
  on API response fields?

### 9. Frontend code quality

Read `webapp/frontend/src/state/AppState.tsx` and the step components
(`BrowseStep`, `PreviewStep`, `ResultStep`). Also read `HistorySidebar.tsx`
and the relevant Fujin components. Check:
- Whether the two new Browse filter toggles (HLO-linked, disk-linked) have
  independent state or share a single boolean — they should be independent
- Whether the inode detail panel in BrowseStep fetches lazily (on expand/click)
  or eagerly (on inventory load); eager fetching for large libraries would be
  a performance regression
- Whether the sidebar link detail panel renders correctly when no link job has
  been run (empty state handling)
- Whether `InodePeer` data returned from the detail endpoint is rendered with
  appropriate empty/loading/error states
- Whether `any_linked: bool` from `ExecuteResponse` is surfaced clearly in
  ResultStep for the "nothing was linked" case
- Whether the `entry` selected in BrowseStep is validated as still present
  before PreviewStep fires the `/api/preview` call

### 10. Observability and operations

Read `webapp/run.py`, the logging setup in `hardlink_organizer.py`, and the
`/health` endpoint. Check:
- Whether the `/health` endpoint's `db_connected` check is still sufficient,
  or whether it could return `true` while the new inode-scan feature is
  in a degraded state
- Whether the peer-scan in `_find_dest_inode_peers` emits any log output on
  partial failures (individual `OSError` paths are silently swallowed — is
  that appropriate, or should a warning be logged?)
- Whether container shutdown is graceful (SIGTERM handling via uvicorn)
- Whether log levels are appropriate for new code paths

### 11. Documentation and operator experience

Read `docs/FIRST_HARDLINK.md`, `config.example.toml`,
`packaging/docker/docker-compose.yml`, and the README. Check:
- Is the inode detail / peer grouping feature documented for operators?
- Is there a clear explanation of what "disk-linked" vs "HLO-linked" means
  in the Browse UI?
- Is the no-auth model documented with a network-exposure warning?
- Are `source_sets` and `dest_sets` config keys documented well enough
  to avoid cross-device misconfiguration?

### 12. Dependency and packaging hygiene

Read `requirements.txt`, `packaging/docker/Dockerfile`, and
`webapp/frontend/package.json`. Check:
- Are Python dependencies pinned appropriately for a stable v1 release?
- Does the Dockerfile follow current best practices?
- Is the Node version current and appropriate?
- Are there npm dependencies with known CVEs or unusual provenance?

---

## Files to read (suggested order)

Read in this order to build context before reviewing details:

1. `hardlink_organizer.py` — full file (~1277 lines); focus on `check_already_linked`, `suggest_destination_name`, `generate_display_name`, `engine/__init__.py` exports
2. `engine/db.py` — full file (~553 lines)
3. `webapp/app.py` — full file (~927 lines); focus on `_find_dest_inode_peers` and the new detail endpoint
4. `webapp/models.py` — full file (~286 lines); focus on `InodePeer`, `InventoryDetailResponse`
5. `engine/__init__.py` — public API surface
6. `engine/verification.py` — full file (~293 lines)
7. `webapp/run.py` — full file (~93 lines)
8. `tests/test_hardlink_organizer.py` — full file
9. `tests/test_webapp.py` — full file
10. `tests/test_engine_db.py` — full file
11. `tests/test_verification.py` — full file
12. `webapp/frontend/src/state/AppState.tsx`
13. `webapp/frontend/src/components/steps/BrowseStep.tsx`
14. `webapp/frontend/src/components/steps/PreviewStep.tsx`
15. `webapp/frontend/src/components/steps/ResultStep.tsx`
16. `webapp/frontend/src/components/HistorySidebar.tsx`
17. `webapp/frontend/src/api/types.ts` and `client.ts`
18. `packaging/unraid/AGENT_PROMPT_file_entry_subfolder.md`
19. `packaging/unraid/AGENT_PROMPT_nlink_refine.md`
20. `config.example.toml`
21. `packaging/docker/Dockerfile`
22. `requirements.txt` and `webapp/frontend/package.json`
23. `docs/FIRST_HARDLINK.md`

---

## Output format

Save your report to:

```
docs/gemini-post-release-audit.md
```

Structure it as follows:

```markdown
# Gemini 3 Post-Release Audit — HardlinkOrganizer v1.0.5

**Review date:** <date>
**Model:** Gemini 3 Pro
**Scope:** Read-only quality audit; no code changes

---

## Summary

<3–5 sentences: overall impressions, most important class of issues found,
and a verdict on whether the pending feature prompts are safe to execute>

---

## Findings

For each finding use this format:

### [DIMENSION] Brief title
**File:** `path/to/file.py:line`
**Severity:** Critical / High / Medium / Low / Observation

<Description of the issue and why it matters.>

**Recommendation:** <What should be done, without writing any code.>

---

## Pending feature prompt assessment

### AGENT_PROMPT_file_entry_subfolder.md
**Verdict:** Safe to run as-is / Needs correction before running

<Issues found, or confirmation that the prompt is accurate and safe.
Include any line numbers that are stale or instructions that conflict
with the current codebase.>

### AGENT_PROMPT_nlink_refine.md
**Verdict:** Safe to run as-is / Needs correction / Redundant (already done)

<Issues found, or confirmation of status.>

---

## What is well-designed

<Concise section on genuinely good patterns worth keeping. Specific file
references expected. Not boilerplate praise.>

---

## Overall verdict

<One paragraph: is the codebase in good shape for continued feature development?
Are there any findings that should be addressed before the pending feature
prompts run? Reference finding IDs.>
```

Rank findings most severe first within each dimension. If a dimension has no
findings, include a one-line note that it was reviewed and is clean.

---

## Constraints

- **No code changes.** Do not edit, create, or delete any source file other
  than writing the output report to `docs/gemini-post-release-audit.md`.
- **No commits.** Do not run `git commit`, `git add`, or any git mutation command.
- **No installs.** Do not run `pip install`, `npm install`, or any package manager.
- **Read-only file I/O only.** You may read any file in the repository.
- Do not reproduce large code blocks verbatim — quote only the specific lines
  relevant to each finding.
- Do not re-report findings from the closed list above.
