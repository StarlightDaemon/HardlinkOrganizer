# Hardlink Organizer Implementation Plan

## Goal

Deliver a first working CLI for Unraid that scans configured ingress directories, writes a structured inventory, presents numbered selections, previews the intended action, validates same-device hardlink constraints, and safely hardlinks selected files or directory trees into configured destination roots without modifying the source payload.

## Delivery strategy

Build the smallest complete v1 that is safe and usable on a real Unraid host. Prefer Python standard library only unless a dependency is clearly justified.

## Scope for the takeover agent

### Must implement

- Config-driven named `source_sets` and `dest_sets`
- `scan` command for one or all source sets
- Top-level inventory of files and directories only
- Structured inventory output in JSON and TSV
- Deterministic numbered listings that map directly to the saved inventory
- `display_name` and `real_name` stored separately
- `list` command for readable terminal display
- `link` command with preview and confirmation support
- `interactive` command for guided selection flow
- Same-device validation before attempting hardlinks
- Recursive file hardlinking for selected directories
- Collision skipping by default
- Persistent logging
- Basic automated tests
- Example config and usage documentation

### Must not implement in v1

- metadata scraping
- external media matching
- moves, deletes, or renames of source data
- automatic bulk organization
- web UI
- Docker packaging

## Recommended technical choices

- Language: Python 3.11+ if available
- Dependency policy: standard library only if possible
- CLI parser: `argparse`
- Config parser: `tomllib`
- Path handling: `pathlib`
- Logging: `logging`
- Structured output: `json` and `csv`
- Tests: `unittest`

## File targets

```text
./
  README.md
  IMPLEMENTATION_PLAN.md
  CLAUDE_CODE_HANDOFF_PROMPT.md
  hardlink_organizer.py
  config.example.toml
  tests/
    test_hardlink_organizer.py
```

## Build order

### Step 1: scaffold the tool

- Create `hardlink_organizer.py`
- Create `config.example.toml`
- Create `tests/test_hardlink_organizer.py`
- Keep the implementation in one file unless it becomes clearly unwieldy

Done when:
- The tool has a runnable CLI entrypoint
- Config can be loaded from a file path argument

### Step 2: implement config and scanning

- Load named source and destination sets from TOML
- Validate configured roots
- Scan top-level entries only
- Ignore hidden top-level entries by default
- Sort results deterministically
- Assign stable per-scan IDs

Done when:
- `scan` can write JSON and TSV inventory files
- `list <source_set>` can render a readable numbered list from the same data model

### Step 3: implement display names

- Preserve `real_name` exactly as found on disk
- Derive `display_name` conservatively
- Replace dots and underscores with spaces
- Collapse repeated whitespace
- Retain obvious year tokens
- Do not use `display_name` for filesystem resolution

Done when:
- Inventory rows contain both names
- Terminal output is readable without losing raw-path accuracy

### Step 4: implement preview and validation

- Validate source existence at execution time
- Validate destination root existence
- Compare device IDs using `stat().st_dev`
- Refuse cross-device operations clearly
- Build a preview object before mutation

Done when:
- `link` and `interactive` can show a preview before writing anything
- Cross-device mismatches fail cleanly and are logged

### Step 5: implement hardlink execution

- Hardlink a selected file into the chosen destination
- For a selected directory, create destination directories normally and hardlink files recursively
- Skip collisions by default
- Continue across safe per-file failures in recursive mode
- Emit a summary at the end

Done when:
- Directory trees are linked file-by-file
- Existing destination files are skipped, not overwritten

### Step 6: implement logging and tests

- Log validation failures, skips, successes, and summaries
- Add unit tests for display-name cleanup, config loading, and validation
- Add integration-style tests for same-filesystem linking and collision handling using temporary directories

Done when:
- `python -m unittest discover` passes locally
- The README includes concrete usage examples

## Acceptance criteria

- The tool can scan configured ingress sets and write both JSON and TSV indexes.
- The numbered list shown to the user is deterministic and corresponds to inventory records.
- The tool preserves raw filesystem names and paths for all actions.
- The tool refuses hardlink attempts across different devices.
- The tool never hardlinks directories themselves.
- Recursive linking creates directories normally and links files individually.
- Existing destination files are skipped and logged by default.
- The user gets a preview or dry-run before mutation.
- The source payload is never moved, renamed, or deleted.

## Suggested command contract

```text
python ./hardlink_organizer.py --config /path/to/config.toml scan
python ./hardlink_organizer.py --config /path/to/config.toml list movies
python ./hardlink_organizer.py --config /path/to/config.toml link movies 2 movies --dry-run
python ./hardlink_organizer.py --config /path/to/config.toml interactive
```

## Validation checklist for the takeover agent

- Run the test suite
- Manually create sample source and destination trees in temporary directories
- Verify `scan` writes expected JSON and TSV
- Verify `list` output matches inventory ordering
- Verify `link --dry-run` prints a correct preview
- Verify real link execution creates hardlinks and not copies
- Verify collisions are skipped
- Verify cross-device validation path exists in code, even if the local test environment uses one device only

## Implementation guardrails

- Do not introduce hidden side effects.
- Do not add delete or move behavior.
- Do not auto-create destination roots outside configured roots.
- Do not rely on cleaned names for source lookups.
- Do not assume `/mnt/user` paths can hardlink without device validation.
- Do not add packaging work in this pass.

## Recommended completion output from the takeover agent

- Brief summary of implemented commands
- Files added or changed
- Test command run and result
- Any residual risks or follow-up items
