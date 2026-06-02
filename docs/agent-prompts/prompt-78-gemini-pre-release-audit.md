# Prompt 78: Pre-Release Code Quality Audit (Read-Only)

**Target model:** Gemini 2.5 Pro (or equivalent high-context reasoning model)

**Mode:** Read-only review. No code changes. No edits. No commits.
Your output is a structured feedback report saved as a markdown file.

---

## What this project is

**HardlinkOrganizer** is a Python/FastAPI tool with a React SPA frontend for
safely planning and executing hardlinks across NAS storage pools. Operators
use it to reorganize media libraries (films, TV, etc.) by hardlinking files
from source directories into destination library structures, preserving disk
space since hardlinks share the same underlying data blocks.

The intended deployment is a Docker container on a NAS (Unraid, TrueNAS), or
a local Linux install. It is a single-user, locally-trusted tool with no
authentication layer — all API callers are assumed to be the operator.

**Version:** `1.0.0-rc.1` (preparing for stable v1.0.0 release)

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## What has already been reviewed and fixed

A prior correctness-focused review identified and closed 15 findings. Do NOT
re-report these — they are resolved:

| ID | What was fixed |
|---|---|
| C-1 | `hardlink_tree`/`hardlink_file` now skip symlinks via `os.lstat`; symlinks-to-dirs no longer recursed |
| C-2 | Default DB path changed from `/tmp/` to `/config/hardlink-organizer.db` |
| H-1 | Inventory now resolved by `full_path` instead of unstable positional ID |
| H-2 | `ExecuteRequest.dest_subpath` is now `str \| None`; fallback is explicit in route |
| M-1 | `webapp/run.py` now reads `HARDLINK_CONFIG` env var as default for `--config` |
| M-2 | PATCH destinations uses `model_dump(exclude_unset=True)`; null clears DB column |
| M-3 | Covered by C-1 (symlink-to-dir recursion eliminated) |
| R-1–R-3 | Version strings aligned across source, Docker, TrueNAS catalog |
| L-1 | Unused `jinja2` dependency removed from `requirements.txt` |
| L-2 | `/health` no longer returns `db_path`; returns `db_connected: bool` instead |
| L-3 | `/tmp` and `/var/tmp` added to `_UNSAFE_DEST_ROOTS` |
| L-4 | `ExecuteResponse` now includes `any_linked: bool` to distinguish no-op from success |

---

## Your task

Read the codebase and produce a **pre-release quality audit**. This is not a
bug hunt — the correctness issues are resolved. You are looking at:

- **Code quality and internal consistency**
- **API design and REST semantics**
- **Architecture and layer boundaries**
- **Security posture** (given the no-auth deployment model)
- **Test suite quality** (not just count — are the right things tested?)
- **Observability and operational readiness**
- **Frontend code quality and state management**
- **Documentation and operator experience**

Be direct and specific. Vague praise or hedging is not useful. If something
is well-designed, say so briefly. If something has a structural issue, name
the file, line, and the concrete consequence.

---

## Review dimensions

Work through each dimension. You do not have to file a finding for every
dimension — if something is genuinely clean, note it as such and move on.

### 1. API design and REST semantics

Read all routes in `webapp/app.py`. Check for:
- HTTP method choices (is POST used where GET or PUT would be appropriate?)
- Status code correctness (201 for creates, 204 for deletes, 404 vs 422 vs 409 usage)
- Resource naming consistency (`/api/verify` vs `/api/destinations` — are conventions uniform?)
- Response shape consistency across related endpoints
- Whether the `/api/scan` endpoint is idempotent or has side effects that aren't communicated
- Error response shapes — does every error path return a structured body or plain text?

### 2. Database layer

Read `engine/db.py` in full. Check for:
- Whether the single shared `sqlite3.Connection` with `threading.RLock` is
  sufficient under FastAPI's async/threading model, or whether it creates
  contention or correctness issues
- Query patterns: are there N+1 queries, missing indexes, or unparameterized
  inputs anywhere?
- Schema: does `_init_schema` create appropriate indexes for the queries
  that run against it?
- Whether the `update_destination` method using `**fields` and dynamic column
  names is safe (there is an `_allowed` set guard — verify it is sufficient)
- Error handling: what happens if `_conn()` is called after `close()`?

### 3. Core engine — hardlink_organizer.py

Read the public API surface: `scan_source_set`, `build_link_plan`,
`execute_link_plan`, `hardlink_file`, `hardlink_tree`. Check for:
- Whether `LinkPlan.is_valid()` path-traversal guard (`resolved_full.relative_to(resolved_root)`)
  is robust — what happens if `dest_root` itself is a symlink?
- Whether `hardlink_file` being public (in `engine/__init__.py` `__all__`) is
  intentional — callers can bypass the symlink guard in `hardlink_tree`
- `generate_display_name` and `suggest_destination_name` — are the transforms
  consistent and well-tested?
- Whether `execute_link_plan` has any TOCTOU window between validation and
  the actual `os.link` call
- The `TypedDict` usage for `InventoryEntry` and `Config` — are all call sites
  type-safe or do they rely on unchecked dict access?

### 4. Web layer architecture

Read `webapp/app.py` and `webapp/models.py`. Check for:
- Whether all routes consistently use `request.app.state.cfg` and
  `request.app.state.db`, or whether some reach for globals
- Whether the `create_app` factory pattern is clean or has hidden coupling
- Whether `_classify_mount_layout_path` is still imported as a private symbol
  directly from `hardlink_organizer` rather than going through `engine/__init__`
- Pydantic v2 correctness: any use of deprecated v1 patterns
  (`validator` vs `field_validator`, `.dict()` vs `.model_dump()`, etc.)
- Whether request validation errors (422) have useful messages or are raw
  Pydantic tracebacks

### 5. Security posture

This is a no-auth, locally-trusted tool. But check:
- Whether any route accepts user-controlled strings that are used in file I/O
  without sanitization (beyond the existing `_UNSAFE_DEST_ROOTS` and
  `is_valid()` path-traversal guard)
- Whether the `update_destination` `**fields` pattern with the `_allowed`
  whitelist fully prevents SQL injection or unexpected column writes
- Whether `/api/scan` accepting a `source_set` name and looking it up in
  `cfg["source_sets"]` is sufficient, or whether it can be manipulated
- Whether serving static files from `_DIST_DIR` has any path traversal risk
- The no-auth model should be documented — is there a note in the README or
  config docs warning operators not to expose the port publicly?

### 6. Test suite quality

Read `tests/test_webapp.py`, `tests/test_hardlink_organizer.py`,
`tests/test_engine_db.py`, and `tests/test_verification.py`. Check:
- Are unhappy paths tested (404s, validation errors, conflicting state)?
- Are the symlink fix tests (added in the C-1 loop) testing the right
  failure mode — do they actually exercise the previously-broken behavior?
- Does the test setup use real filesystem temp dirs or mocked paths? If
  mocked, are the mocks tight enough to catch real bugs?
- Is there any test coverage for the verification flow end-to-end?
- Are there test helpers / fixtures that duplicate logic in the app itself
  (a sign tests may pass even when the app is broken)?
- Are the `test_execute_*` tests asserting on hardlink correctness (checking
  `os.stat().st_nlink` after execute) or only on API response fields?

### 7. Frontend code quality

Read `webapp/frontend/src/state/AppState.tsx` and the step components
(`SourceStep`, `BrowseStep`, `DestStep`, `PreviewStep`, `ResultStep`). Check:
- Whether the wizard flow state machine is explicit (guarded step transitions)
  or implicit (any step can be reached in any order)
- Whether API errors are handled consistently across steps or only in some
- Whether the `entry` selected in `BrowseStep` is ever validated as still
  present before `PreviewStep` fires the `/api/preview` call
- Whether the `any_linked: bool` field (added in L-4) is surfaced in the UI
  clearly enough for an operator to understand "nothing was linked"
- Whether there are any obvious missing loading/error states that would
  confuse an operator during a slow scan or network hiccup

### 8. Observability and operations

Read `webapp/run.py`, the logging setup in `hardlink_organizer.py`
(`setup_logging`), and the `/health` endpoint. Check:
- Whether the startup banner (`╔══════...╗`) logs to stdout consistently, or
  could be suppressed in some deployment configurations
- Whether log levels are appropriate — are DEBUG messages too verbose for
  production, or are INFO messages missing for important operations?
- Whether there is any structured logging or only freeform strings
- Whether the `/health` endpoint's `db_connected` check (SELECT 1) is
  sufficient for a liveness probe, or whether it could return `true` while
  the app is in a degraded state
- Whether container shutdown is graceful (SIGTERM handling)

### 9. Documentation and operator experience

Read `docs/FIRST_HARDLINK.md`, `config.example.toml`, `packaging/docker/docker-compose.yml`,
and the README if present. Check:
- Is there a clear "getting started" path for a new operator?
- Are the volume mount requirements clearly documented?
- Is the no-auth model documented as a deliberate design choice with a
  warning about network exposure?
- Are the `source_sets` and `dest_sets` config keys documented well enough
  that an operator won't misconfigure cross-device paths?
- Is there any documentation of what happens when a hardlink operation fails
  partway through (partial link state)?

### 10. Dependency and packaging hygiene

Read `requirements.txt`, `packaging/docker/Dockerfile`, and
`webapp/frontend/package.json`. Check:
- Are Python dependencies pinned to a version range that's too loose or
  too tight for a stable v1 release?
- Does the Dockerfile follow current best practices (non-root user ✓ already —
  are there other issues)?
- Is the Node version (20-slim) current and appropriate?
- Are there any `npm` dependencies that look unusual, outdated, or
  have known CVEs worth flagging?

---

## Files to read (suggested order)

Read in this order to build context before reviewing details:

1. `hardlink_organizer.py` — full file (1222 lines); the core engine
2. `engine/db.py` — full file (500 lines)
3. `webapp/app.py` — full file (707 lines)
4. `webapp/models.py` — full file (264 lines)
5. `engine/__init__.py` — public API surface
6. `engine/verification.py` — full file (293 lines)
7. `webapp/run.py` — full file (90 lines)
8. `tests/test_webapp.py` — full file
9. `tests/test_hardlink_organizer.py` — full file
10. `tests/test_engine_db.py` — full file
11. `tests/test_verification.py` — full file
12. `webapp/frontend/src/state/AppState.tsx`
13. `webapp/frontend/src/components/steps/` — all step files
14. `webapp/frontend/src/api/types.ts` and `client.ts`
15. `config.example.toml`
16. `packaging/docker/Dockerfile`
17. `requirements.txt` and `webapp/frontend/package.json`
18. `docs/FIRST_HARDLINK.md`

---

## Output format

Save your report to:

```
docs/gemini-pre-release-audit.md
```

Structure it as follows:

```markdown
# Gemini Pre-Release Audit — HardlinkOrganizer v1.0.0-rc.1

**Review date:** <date>
**Model:** <model name>
**Scope:** Read-only quality audit; no code changes

---

## Summary

<3–5 sentences on overall impressions: what is strong, what is the most
important class of issues found, and a release readiness verdict>

---

## Findings

For each finding use this format:

### [DIMENSION] Brief title
**File:** `path/to/file.py:line`
**Severity:** Critical / High / Medium / Low / Observation

<Description of the issue and why it matters.>

**Recommendation:** <What should be done, without writing any code.>

---

## What is well-designed

<A concise section on genuinely good patterns worth keeping — not boilerplate
praise. Specific file references expected.>

---

## Release readiness verdict

<One paragraph: is this ready for stable v1.0.0, or are there specific things
that should be addressed first? Reference finding IDs.>
```

Rank findings most severe first within each dimension. If a dimension has no
findings, include a one-line note that it was reviewed and is clean. Do not
omit dimensions from the report.

---

## Constraints

- **No code changes.** Do not edit, create, or delete any source file other
  than writing the output report to `docs/gemini-pre-release-audit.md`.
- **No commits.** Do not run `git commit`, `git add`, or any git mutation command.
- **No installs.** Do not run `pip install`, `npm install`, or any package manager.
- **Read-only file I/O only.** You may read any file in the repository.
- Do not reproduce large code blocks verbatim in the report — quote only the
  specific lines relevant to each finding.
