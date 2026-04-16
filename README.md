# Hardlink Organizer

## Status

- Status: `0.3.0` verification foundation
- Category: internal-only
- Platform target: Unraid
- Interface target: hosted web UI (primary) + CLI fallback

## Version

- Current version: `0.3.0`
- Current milestone: verification foundation and UI
- Next target: `0.4.x` — Destination management

## Project Control Plane

This workspace now operates as its own project with a local Agent Ledger under
`./agent-ledger/`.

Start there for execution planning and continuity:

- `agent-ledger/README.md`
- `agent-ledger/CURRENT_STATE.md`
- `agent-ledger/OPEN_LOOPS.md`
- `agent-ledger/WORK_LOG.md`

## Purpose

Inventory configured ingress or download roots, present a readable numbered list of candidate items, and organize selected source items into destination library roots by hardlinking without moving or renaming the torrent source.

## Product summary

This tool is intended for active torrent and seeding workflows where the source payload must remain intact. The v1 focus is explicit operator control, structured inventory output, preview before execution, same-device validation, and safe recursive hardlink creation for directory trees.

## Recommended implementation choice

- Language: Python
- Reasoning: Python is the better v1 choice here because the tool needs structured index output, reliable path handling, logging, interactive prompts, recursive traversal, and a clean path to later Dockerization.
- Constraint: keep the runtime simple enough for Unraid by avoiding heavy dependencies in v1.

## v1 scope

- Named source sets and destination sets loaded from config
- Scan one or more source sets
- Inventory top-level files and directories
- Generate structured inventory output in JSON and TSV
- Preserve both `real_name` and `display_name`
- Show deterministic numbered listings derived from the index
- Support `scan`, `list`, `link`, and `interactive` commands
- Suggest a destination folder name from the display name
- Preview source, destination, and validation results before mutation
- Validate same underlying filesystem or device before linking
- Hardlink files individually, including recursive linking for selected directories
- Skip existing destination files by default
- Log validation failures, skips, successes, and summaries

## Explicit non-goals for v1

- metadata scraping
- TMDB or TVDB matching
- Sonarr or Radarr replacement behavior
- global duplicate detection
- aggressive renaming or library reorganization
- destructive source moves or deletes

Note:
The `0.1.0` CLI baseline is complete. The `0.2.0` web-app alpha adds a hosted
browser UI, a SQLite state database, and Docker packaging groundwork.

## Running the web app

```bash
# Install dependencies
pip install -r ./requirements.txt

# Start the web server
python ./webapp/run.py \
  --config ./config.toml \
  --port 7700

# Open in browser
open http://localhost:7700
```

The CLI remains fully operational alongside the web app:

```bash
python ./hardlink_organizer.py \
  --config config.toml scan
```

## Running tests

The project uses `pytest` for integration and unit testing.

```bash
# Run web app and engine tests
python -m pytest ./tests/
```

## Verification API

Added in `0.3.0`. Allows triggering verification of a prior link job and
inspecting the per-file results.

### Trigger a verification run

```bash
POST /api/verify
Content-Type: application/json

{"mode": "link_history", "link_history_id": <id>}
```

Returns `{"run_id": <int>}`.

### Inspect results

```bash
GET /api/verify/{run_id}
```

Returns a `VerificationRunResponse` containing summary counts and per-file
result records. Each result record includes:

- `source_path` — absolute path to the source file that was checked
- `candidate_dest` — the expected destination path derived from the history record
- `source_dev`, `source_inode`, `source_nlink` — filesystem metadata for the source
- `dest_dev`, `dest_inode`, `dest_nlink` — filesystem metadata for the destination
- `status` — one of:
  - `verified_hardlinked`
  - `exists_but_not_hardlinked`
  - `missing_at_destination`
  - `cannot_verify_symlink`
  - `cannot_verify_permission_error`
  - `cannot_verify_cross_filesystem`
- `notes` — optional human-readable detail

### Export results

```bash
GET /api/verify/{run_id}/export.json
GET /api/verify/{run_id}/export.csv
```

Returns the verification run data in the requested format.
- `export.json`: Returns the raw JSON representation of the run, including all metadata, summary counts, and the `results` list.
- `export.csv`: Returns a plain text CSV file with one row per result, suitable for audit and manual review. Headers include status, paths, and filesystem metadata.

## Local state database

Starting in `0.2.0`, the tool maintains a SQLite database at the path configured
by `db_file` in `[paths]`. This database records:

- **Scan history** — when each source set was last scanned and how many entries were found
- **Inventory snapshots** — the last seen index per source set (avoids re-scanning to browse)
- **Link history** — every link operation (linked/skipped/failed counts, paths, timestamps)

This is the foundation for future capabilities including link status indicators,
audit trails, and deduplication hints. The database is a single file and can be
deleted without affecting the source or destination filesystems.

## Packaging for Unraid

See `packaging/unraid/README.md` for Docker hosting instructions.

The repository also includes a GitHub Actions workflow for building and publishing
the Unraid Docker image to GHCR once the repo is pushed to GitHub.

Community Apps publication prep assets also exist under `packaging/unraid/`
so the project can move from local Docker usage toward a proper Unraid template flow.

Tool-specific planning, ledger, and handoff notes now live inside this project
workspace so it can stand on its own without chasing parent-repo documents.

## Planned CLI surface

```text
hardlink-organizer scan [--set <name>] [--json-out <path>] [--tsv-out <path>]
hardlink-organizer list <source_set>
hardlink-organizer link <source_set> <entry_id> <dest_set> [--dest-subpath <path>] [--dry-run]
hardlink-organizer interactive
hardlink-organizer validate <source_path> <dest_root>
```

## Concrete usage examples

```bash
# Scan all configured source sets and write index files
py hardlink_organizer.py --config config.toml scan

# Scan only the 'movies' source set
py hardlink_organizer.py --config config.toml scan --set movies

# List entries for a source set (uses saved index or falls back to live scan)
py hardlink_organizer.py --config config.toml list movies

# Dry-run: preview exactly what would be hardlinked
py hardlink_organizer.py --config config.toml link movies 3 movies --dry-run

# Real link (prompts for confirmation)
py hardlink_organizer.py --config config.toml link movies 3 movies

# Override the destination subpath
py hardlink_organizer.py --config config.toml link movies 3 movies --dest-subpath "Interstellar (2014)"

# Check whether two paths are on the same device
py hardlink_organizer.py --config config.toml validate /mnt/user/ingress/movies /mnt/user/media/movies

# Fully guided interactive workflow
py hardlink_organizer.py --config config.toml interactive
```

## Proposed config model

Use a single editable config file with simple named sets and tool defaults.

```toml
[paths]
index_json = "/tmp/hardlink-organizer/index.json"
index_tsv = "/tmp/hardlink-organizer/index.tsv"
log_file = "/boot/logs/hardlink-organizer.log"

[settings]
include_hidden = false
collision_policy = "skip"
default_command = "interactive"

[source_sets]
movies = "/mnt/user/moviesingress"
shows = "/mnt/user/showsingress"
audiobooks = "/mnt/user/audiobooksingress"

[dest_sets]
movies = "/mnt/user/movies"
shows = "/mnt/user/shows"
audiobooks = "/mnt/user/audiobooks"
```

## Inventory model

Each scanned item should retain the real filesystem identity and the user-facing display identity.

### Required fields

- `id`
- `source_set`
- `entry_type`
- `display_name`
- `real_name`
- `full_path`

### Optional useful fields

- `scan_time`
- `size_bytes`
- `device_id`

## Display-name strategy

The cleaned name must never be used to locate the source item on disk. It is presentation-only and may also be used as the initial destination folder suggestion.

### Initial cleanup rules

- replace `.` and `_` with spaces
- collapse repeated whitespace
- trim leading and trailing whitespace
- retain an obvious year token and format it as `(YYYY)` when practical
- strip trailing release tags only when the result is still clearly better than the raw name
- stay conservative for TV content

## Safety rules

- Validate the source still exists immediately before execution
- Validate the configured destination root exists before linking
- Compare device IDs at runtime using the actual source item and destination parent
- Refuse the operation when source and destination are on different devices
- Never attempt to hardlink directories themselves
- Create destination directories normally and hardlink only files
- Skip destination collisions by default
- Preserve the source tree unchanged
- Offer preview or `--dry-run` before execution

## Proposed internal structure

```text
./
  README.md
  IMPLEMENTATION_PLAN.md
  CLAUDE_CODE_HANDOFF_PROMPT.md
  VERSION
  hardlink_organizer.py
  config.example.toml
  tests/
```

## Handoff artifacts

- Implementation plan: `./IMPLEMENTATION_PLAN.md`
- Repo-agent prompt: `./CLAUDE_CODE_HANDOFF_PROMPT.md`
- Release plan: `./V1_RELEASE_PLAN.md`
- Web-app plan: `./WEB_APP_IMPLEMENTATION_PLAN.md`
- Web-app agent prompt: `./WEB_APP_CODE_AGENT_PROMPT.md`
- Small slice prompts: `./SMALL_SLICE_PROMPTS.md`
- Split agent prompts: `./agent-prompts/`
- Larger hardening prompt: `./agent-prompts/prompt-10-release-hardening-pass.md`

## Suggested module breakdown

- `load_config`
- `scan_source_set`
- `scan_all_sets`
- `generate_display_name`
- `write_index_json`
- `write_index_tsv`
- `load_index`
- `list_entries`
- `suggest_destination_name`
- `validate_source`
- `validate_dest_root`
- `validate_same_device`
- `preview_link_plan`
- `hardlink_file`
- `hardlink_tree`
- `log_action`
- `run_interactive_flow`

## Execution flow

1. Load config and validate declared source and destination roots.
2. Scan one or more source sets and build a deterministic in-memory index.
3. Persist the index to JSON and TSV.
4. Present a numbered list derived from the same index.
5. Let the user select source set, entry, and destination set.
6. Suggest a destination folder name from the display name.
7. Preview the final source and destination mapping plus validation results.
8. On confirmation, create directories as needed and hardlink files only.
9. Emit a summary and append detailed log records.

## Implementation phases

### Phase 1

- Build config loader
- Build scanner for top-level entries only
- Write JSON and TSV index files
- Implement deterministic `list` output

Acceptance:
- Scans configured sets
- Produces parsable inventory
- Displays numbered entries consistently

### Phase 2

- Add display-name cleanup
- Preserve raw names and paths alongside display names
- Add destination name suggestion logic

Acceptance:
- Human-readable output improves without affecting raw-path accuracy

### Phase 3

- Add interactive selection flow
- Add preview and confirmation step
- Add non-interactive `link` command

Acceptance:
- User can safely choose item and destination without editing code or paths each run

### Phase 4

- Add same-device validation
- Add recursive hardlink execution
- Add collision handling and persistent logging
- Add result summaries

Acceptance:
- File trees can be linked safely
- Collisions are skipped and logged
- Cross-device operations are refused

## Testing plan

- Unit tests for display-name cleanup
- Unit tests for config parsing and validation
- Unit tests for device validation behavior
- Unit tests for risky Unraid mount-layout warnings and safe shared-parent layouts
- Integration tests using temporary directories on the same filesystem
- Integration tests for recursive directory linking and collision skipping
- Manual Unraid verification using real `/mnt/user` paths before relying on the tool operationally

## Risks and open questions

- `/mnt/user` paths may appear compatible while resolving to different devices or
  different execution contexts, so validation must be runtime-based and not
  path-prefix-based.
- Separate source and destination bind mounts can still fail with `EXDEV` on
  Unraid even when same-device preview succeeds; shared disk-level parent mounts
  are the current reliable pattern.
- Large active downloads may change during scan or link execution, so existence checks must happen again at execution time.
- TV naming is inherently messier than movie naming, so the first display-name implementation should prefer conservative readability over aggressive cleanup.
- If Python availability is inconsistent on the target Unraid host, packaging or a minimal bundled runtime may need to be addressed earlier.

## Graduation path

- Internal-only v1 CLI
- Optional packaging under `packaging/unraid/` once the core workflow is proven
- Optional Docker image only after the direct host workflow is stable and documented
