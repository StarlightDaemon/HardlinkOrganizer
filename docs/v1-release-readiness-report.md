# HardlinkOrganizer — v1.0.0 Release Readiness Report

**Review date:** 2026-06-01
**Branch:** `main` · 1 commit ahead of `origin/main`
**Test suite:** 180 passed, 0 failed
**Reviewed by:** Claude Code (full-repo multi-angle review)

---

## Summary

The codebase is structurally sound and comprehensively tested. Two critical runtime bugs exist that affect core data-integrity guarantees (symlink handling and ephemeral database state). A cluster of version-string mismatches must be resolved before the tag is final. Several medium and low issues are documented below. No security vulnerabilities in the traditional sense, though the no-auth model must be documented.

---

## CRITICAL — Must fix before v1.0.0

### C-1 · `hardlink_tree` hardlinks symlink inodes instead of file data
`hardlink_organizer.py:844` (also `hardlink_file:789`)

`hardlink_tree` calls `hardlink_file(child, target, ...)` for any `child.is_file()`. On Linux, `is_file()` follows symlinks, so a symlink-to-file passes the check. Then `os.link(symlink_path, dst)` creates a hardlink to the *symlink inode*, not the actual file data inode. The real file's `nlink` count never increases. The destination entry is a symlink pointing to the original absolute path, not a hardlink at all. If the source is ever removed, the destination silently becomes dangling.

Additionally in `hardlink_file:789`, `samestat` follows symlinks — so an existing symlink at `dst` whose target shares the source's inode is misidentified as a successful hardlink and silently appended to `result.linked`. The history is then recorded as "linked" but no real hardlink exists.

**Impact:** Any source directory containing symlinks (common in torrent client setups) produces incorrect results silently. The core operation guarantee is violated.

**Fix:** In `hardlink_tree`, add `elif child.is_symlink(): _logger.debug("SKIP (symlink): %s", child)` before the `is_file()` check. In `hardlink_file`, use `os.lstat` instead of `stat` for the samestat check.

---

### C-2 · Default database path is ephemeral in Docker
`webapp/run.py:62`

```python
db_path = cfg["paths"].get("db_file", "/tmp/hardlink-organizer/state.db")
```

The default falls back to `/tmp/`, which is ephemeral in a container. The Dockerfile provisions `/config` and `/data` volumes but they are never used by this default. Every container restart silently destroys the full state: all scan history, verification runs, and saved destination registry entries.

**Impact:** Operators who don't explicitly set `db_file` in `config.toml` lose all state on container restart without any warning. This is a first-run trap.

**Fix:** Change the default to `"/config/hardlink-organizer.db"` to match the volume already defined in the Dockerfile.

---

## HIGH — Should fix for v1.0.0

### H-1 · Inventory entry IDs are positional and unstable across rescans
`engine/db.py:212`

`get_latest_inventory` reassigns IDs as sequential row offsets (`d["id"] = idx`). These are the IDs used by the frontend for preview and execute requests. If a background rescan runs after the user loads the inventory but before they submit execute, the positional index shifts — entry ID 5 in the browser may now refer to a different item.

**Impact:** User could inadvertently hardlink a different source entry than the one they selected, with no error or warning.

**Fix:** Use the stable `inventory.id` primary key (auto-increment from the database insert) as the exposed ID, rather than reassigning positional offsets. Or include `full_path` in the execute payload and validate it against the inventory entry.

---

### H-2 · Empty `dest_subpath` in execute silently falls back to a generated name
`webapp/app.py:395`

`ExecuteRequest.dest_subpath` is typed as `str` (non-optional). If a client sends `""`, `build_link_plan`'s guard `if not dest_subpath:` fires and substitutes `suggest_destination_name(entry["display_name"])`. The links land at a different path than the one the user reviewed in the preview step, with no error.

**Impact:** The execution path diverges silently from the previewed path. History records the substituted path.

**Fix:** Make `dest_subpath` `Optional[str]` in `ExecuteRequest` (consistent with `PreviewRequest`), and apply the same `or suggest_destination_name(...)` guard explicitly in the execute route, making the fallback visible.

---

## RELEASE BLOCKERS — Must resolve for any public release

### R-1 · `__version__` still reads `0.3.0`
`hardlink_organizer.py:31` · `VERSION`

The in-code `__version__ = "0.3.0"` and the `VERSION` file both say `0.3.0`. The git tag is `v1.0.0-rc.1`. The Docker label (`1.0.0-rc.1`) and TrueNAS catalog (`1.0.0`) are ahead of the source. The `/health` endpoint and CLI `--version` will report `0.3.0` after a v1 release.

---

### R-2 · `docker-compose.yml` references the old `0.3.0` image tag
`packaging/docker/docker-compose.yml:12`

```yaml
image: hardlink-organizer:0.3.0
```

This image will not exist once v1 ships. Users deploying from this file get an immediate pull failure.

**Fix:** Update to `ghcr.io/<owner>/hardlink-organizer:v1.0.0-rc.1` (or `:latest`) and add a comment showing the canonical GHCR path.

---

### R-3 · TrueNAS catalog declares `app_version: "1.0.0"` while artifact is RC
`packaging/truenas/catalog/app.yaml:3`

The catalog advertises the final `1.0.0` version but the image being shipped is `v1.0.0-rc.1`. If the RC image is replaced without bumping the catalog, users run an undeclared version.

---

## MEDIUM

### M-1 · `HARDLINK_CONFIG` env var is a dead letter
`packaging/docker/Dockerfile:48`

The Dockerfile sets `ENV HARDLINK_CONFIG=/config/config.toml` but `webapp/run.py` reads only `args.config` (the `--config` CLI flag). CMD hardcodes `--config /config/config.toml`. Setting `HARDLINK_CONFIG` in `docker-compose.yml` has no effect.

**Fix:** In `webapp/run.py`, read `os.environ.get("HARDLINK_CONFIG")` as the default for `--config` if not explicitly passed.

---

### M-2 · PATCH `/api/destinations` cannot clear optional fields once set
`webapp/app.py:673`

```python
patch: dict = {k: v for k, v in body.model_dump().items() if v is not None}
```

Sending `{"tag": null}` is silently ignored — `tag` stays set. There is no way to clear `tag` or `notes` via the API.

**Fix:** Use Pydantic's `model_dump(exclude_unset=True)` instead of the `is not None` filter, so explicitly-sent `null` is treated as a clear.

---

### M-3 · `hardlink_tree` and `_iter_source_files` have no cycle detection for symlinked directories
`hardlink_organizer.py:839` · `engine/verification.py:175`

Both recurse into directories by following symlinks (`is_dir()` follows symlinks; `rglob` follows symlinks). A circular symlink in the source tree causes infinite recursion in `hardlink_tree` and an infinite loop in the verify path.

**Impact:** Low probability in practice — source trees are user-controlled — but causes process hang/crash if encountered.

**Fix:** Track visited inodes during tree walk; skip any inode seen before.

---

## LOW

### L-1 · `jinja2` is an unused dependency
`requirements.txt:6`

Jinja2 has zero imports in the codebase (confirmed by grep). It is a leftover from the pre-React era. Jinja2 has had SSTI CVEs; keeping it installed unnecessarily expands attack surface.

---

### L-2 · `/health` endpoint exposes the internal database file path
`webapp/app.py:180`

```python
return HealthResponse(db_path=str(d._path))
```

This leaks the container-internal filesystem path of the SQLite database to any unauthenticated caller.

**Fix:** Omit `db_path` from the health response, or return only a sanitized basename.

---

### L-3 · `/tmp` is not in `_UNSAFE_DEST_ROOTS`
`webapp/app.py:72`

Misconfiguring a destination as `/tmp` passes validation with no warning. Hardlinks written to `/tmp` are lost on reboot or tmpfs flush.

**Fix:** Add `"/tmp"` (and optionally `"/var/tmp"`) to `_UNSAFE_DEST_ROOTS`.

---

### L-4 · `success: true` when 0 files linked and 0 failed (all skipped)
`webapp/app.py:443`

```python
success=len(result.failed) == 0
```

A no-op (all files already existed at destination) returns `success: true, linked: 0`. The UI shows green success for an execution that did nothing, which may mask a prior partial failure or a misconfiguration.

---

## Findings Index (machine-readable)

```json
[
  {"file": "hardlink_organizer.py", "line": 844, "severity": "critical", "summary": "hardlink_tree hardlinks symlink inode instead of file data when source dir contains symlinks to files", "failure_scenario": "src dir has symlink-to-file → os.link(symlink_path, dst) creates hardlink to symlink inode → real file nlink stays 1 → destination is effectively a dangling symlink if source is removed"},
  {"file": "webapp/run.py", "line": 62, "severity": "critical", "summary": "Default db_path falls back to /tmp which is ephemeral in containers", "failure_scenario": "User does not set db_file in config.toml → every container restart destroys all scan history, verification runs, and destination registry silently"},
  {"file": "engine/db.py", "line": 212, "severity": "high", "summary": "Inventory IDs are positional offsets reassigned on each DB read, not stable primary keys", "failure_scenario": "Background rescan between inventory load and execute shifts IDs → execute resolves entry_id=5 to a different item than the user selected → wrong source hardlinked into destination"},
  {"file": "hardlink_organizer.py", "line": 789, "severity": "high", "summary": "samestat uses stat() which follows symlinks, misidentifying a symlink at dst as an existing hardlink", "failure_scenario": "Symlink at dst points to same inode as src → samestat returns True → appended to result.linked → history records successful link → no real hardlink was ever created"},
  {"file": "hardlink_organizer.py", "line": 31, "severity": "release-blocker", "summary": "__version__ = '0.3.0' while git tag and Docker label are v1.0.0-rc.1", "failure_scenario": "After v1 release, CLI --version and /health API report 0.3.0; any automation that validates deployed version gets a false negative"},
  {"file": "packaging/docker/docker-compose.yml", "line": 12, "severity": "release-blocker", "summary": "image tag hardlink-organizer:0.3.0 will not exist once v1 ships", "failure_scenario": "docker-compose up fails with image-not-found; users must manually edit the file before the service starts"},
  {"file": "webapp/app.py", "line": 395, "severity": "high", "summary": "Empty dest_subpath in ExecuteRequest silently falls back to a generated name, diverging from previewed path", "failure_scenario": "Client sends dest_subpath='' → build_link_plan substitutes display-name-derived path → files linked at different location than user confirmed in preview"},
  {"file": "packaging/truenas/catalog/app.yaml", "line": 3, "severity": "release-blocker", "summary": "app_version declares 1.0.0 final while the Docker artifact is still v1.0.0-rc.1", "failure_scenario": "TrueNAS catalog installs and reports version 1.0.0 stable while pulling an RC image; if RC is later replaced without catalog bump, users run an undeclared version"},
  {"file": "webapp/app.py", "line": 673, "severity": "medium", "summary": "PATCH /api/destinations filters None values, making it impossible to clear optional fields once set", "failure_scenario": "Send PATCH {tag: null} to clear a tag → None filtered out → tag unchanged → no error returned → UI shows stale tag"},
  {"file": "hardlink_organizer.py", "line": 839, "severity": "medium", "summary": "hardlink_tree has no cycle detection for symlinked directories, enabling infinite recursion", "failure_scenario": "Source dir contains circular symlink → is_dir() follows symlink → hardlink_tree recursed without limit → stack overflow / process hang"},
  {"file": "packaging/docker/Dockerfile", "line": 48, "severity": "medium", "summary": "ENV HARDLINK_CONFIG is set but webapp/run.py never reads it; config path is hardcoded in CMD", "failure_scenario": "Operator sets HARDLINK_CONFIG=/custom/path.toml in docker-compose env block → run.py ignores it → app always loads /config/config.toml → custom config path silently has no effect"},
  {"file": "requirements.txt", "line": 6, "severity": "low", "summary": "jinja2 is listed as a dependency but is not imported anywhere in the codebase", "failure_scenario": "Unused library installed in every image; Jinja2 has had SSTI CVEs; automated vuln scanners will flag it on a library the app doesn't use"},
  {"file": "webapp/app.py", "line": 180, "severity": "low", "summary": "/health endpoint exposes db._path, leaking the internal database file path unauthenticated", "failure_scenario": "Any caller of /health (unauthenticated) receives the container-internal DB path; aids filesystem layout enumeration"},
  {"file": "webapp/app.py", "line": 72, "severity": "low", "summary": "/tmp is not in _UNSAFE_DEST_ROOTS, so /tmp is accepted as a valid hardlink destination", "failure_scenario": "Operator misconfigures dest as /tmp → validation passes with no warning → hardlinks written to tmpfs → lost on reboot or tmpfs flush"},
  {"file": "webapp/app.py", "line": 443, "severity": "low", "summary": "success=True when all files were skipped and none were linked, misrepresenting a no-op as success", "failure_scenario": "All dest paths already exist → result.failed=[] → success:true, linked:0 → UI shows green success for an operation that changed nothing"}
]
```

---

## Release gate summary

| Severity | Count | Gate |
|---|---|---|
| Critical | 2 | Must fix |
| High | 3 | Should fix |
| Release blocker | 3 | Must fix |
| Medium | 3 | Should fix |
| Low | 4 | Optional for RC |

**Minimum required for a stable `v1.0.0` tag:** resolve C-1, C-2, R-1, R-2, R-3. The symlink hardlinking bug (C-1) is the most important — it silently produces wrong results for a large fraction of real-world source trees.
