# Prompt 70: Backend Code Review

Recommended model:
- Claude Opus 4.6 (thinking)

Recommended mode:
- planning off

## Goal

Perform a thorough review of the Hardlink Organizer Python backend. Find real
issues — safety bugs, correctness gaps, security problems, and edge cases —
with file:line references and priority ratings. Do not rewrite code. Do not
suggest style changes or refactors unless they are load-bearing for correctness.

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## Read these files in full before starting — no exceptions

Read them in this order so you build context correctly:

1. `engine/exceptions.py` — custom exception types
2. `engine/db.py` — SQLite schema, migrations, all DB methods
3. `engine/verification.py` — link verification logic
4. `webapp/models.py` — all Pydantic request/response models
5. `hardlink_organizer.py` — core hardlink engine (scan, plan, execute, validate)
6. `webapp/app.py` — all FastAPI routes and request handling
7. `tests/test_engine_db.py` — DB test coverage (to understand what is already tested)
8. `tests/test_hardlink_organizer.py` — engine test coverage
9. `tests/test_verification.py` — verification test coverage
10. `tests/test_webapp.py` — webapp test coverage

Read the test files to identify coverage gaps, not to review the tests themselves.

---

## What to look for

Review each production file against these categories. Only report findings that
are real issues — not theoretical, not stylistic.

### Category A — Safety / data integrity (highest priority)

These could cause data loss, silent corruption, or undetected bad links.

- Race conditions between scan phase and execute phase (filesystem state changes
  between when paths are inventoried and when `os.link()` is called)
- Same-device validation: is it actually blocking cross-device links in all code
  paths, or only in the happy path?
- Collision handling: what happens if the destination path already exists as
  something other than a hardlink to the same inode? Is it skipped, overwritten,
  or does it raise?
- Atomicity: if a batch execute fails partway through, is the DB state consistent
  with what actually happened on disk?
- Verification logic: can `engine/verification.py` produce false positives (claims
  a link is valid when it is not) or false negatives?

### Category B — Security (high priority)

These could allow a user to read or write outside intended paths.

- Path traversal in API inputs: can a crafted `path` parameter in any route
  escape the configured source/destination roots?
- Unsafe root blocklist in destination validation: is the blocklist in `app.py`
  complete? Are there missing dangerous paths (e.g. `/boot`, `/etc`, `/proc`,
  `/sys`, `/dev`, paths under `/run`)?
- Error responses: do any exception handlers return raw filesystem paths,
  exception messages, or stack traces to the API caller?
- Any `shell=True` subprocess calls or string-interpolated shell commands

### Category C — Correctness (medium priority)

Bugs that would produce wrong results without crashing.

- DB schema migration guard: does `_init_schema()` in `db.py` correctly handle
  the case where the DB exists but is missing a column added in a later migration?
  Is the migration idempotent?
- `record_link()` and `get_history()`: are all fields correctly round-tripped?
  Any nullable fields that callers assume are non-null?
- Pydantic models: are there fields in `models.py` that accept unbounded strings
  or integers where a constraint would prevent bad data reaching the engine?
- Route error handling in `app.py`: are all expected exception types from the
  engine caught and mapped to appropriate HTTP status codes, or do some bubble up
  as 500s?

### Category D — Reliability / edge cases (lower priority)

Issues that would surface under unusual but realistic conditions.

- SQLite thread safety: is the DB connection used in a way that is safe under
  FastAPI's async/threaded request handling?
- What happens when a configured source or destination path does not exist at
  startup or disappears mid-operation?
- Large inventory: are there any in-memory structures that would become
  problematic with a very large source set (e.g. thousands of entries)?
- The PUID/PGID privilege drop in the container entrypoint: does the application
  assume it runs as root for any filesystem operations that would fail after the
  drop to the configured UID?

### Category E — Test coverage gaps

For each Category A and B issue you find, note whether there is an existing test
that would catch it. If not, note the gap (one line — no need to write the test).

---

## Output format

Produce a findings list grouped by category. For each finding:

```
[PRIORITY] Short title
File: path/to/file.py:line_number
Issue: one or two sentences describing the exact problem
Impact: what goes wrong if this is not fixed
Gap: yes/no — is there a test that would catch this?
```

After the findings list, add a short **Summary** section (5–8 lines) covering:
- The highest-risk area overall
- Any systemic pattern across multiple findings
- Whether the codebase is broadly safe to ship as-is, or if specific issues
  should be fixed before the 1.0 release

Do not suggest fixes unless a finding is so ambiguous that the fix is needed to
explain the problem. Keep the full response under 1500 words.

---

## What NOT to do

- Do not rewrite or refactor any code
- Do not comment on naming, formatting, or code style
- Do not flag issues that are already handled correctly
- Do not update CURRENT_STATE.md or any state files — this is read-only
- Do not make any commits
