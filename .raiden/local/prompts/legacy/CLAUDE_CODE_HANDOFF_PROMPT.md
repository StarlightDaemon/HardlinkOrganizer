# Claude Code Handoff Prompt

Use this as the prompt for a Claude Sonnet or Opus repo agent that will implement the tool in this repository.

```text
You are taking over implementation of a planned internal tool in this repository.

Repository root:
/mnt/e/HardlinkOrganizer

Primary brief:
./README.md

Execution plan:
./notes/plans/IMPLEMENTATION_PLAN.md

Repository conventions to follow:
- .raiden/state/DECISIONS.md
- .raiden/state/OPEN_LOOPS.md
- AGENTS.md

Task:
Implement the first working version of Hardlink Organizer as a CLI-first Python tool.

What the tool must do:
- Load named source sets and destination sets from config
- Scan configured source sets and inventory top-level files and directories
- Write structured inventory output in both JSON and TSV
- Preserve both real filesystem names and cleaned display names
- Show deterministic numbered lists for selection
- Support a guided interactive flow
- Support a direct link command
- Suggest a destination folder name from the cleaned display name
- Preview planned actions before mutation
- Validate that source and destination are on the same device before hardlinking
- Hardlink files safely without moving or renaming the source payload
- For selected directories, create the destination tree normally and hardlink files recursively
- Skip existing destination files by default
- Log actions, skips, validation failures, and summaries

Hard requirements:
- Target Unraid-safe behavior
- Preserve the source tree
- Refuse cross-device hardlink attempts
- Never hardlink directories themselves
- Keep raw paths authoritative for filesystem operations
- Prefer Python standard library only unless a dependency is truly necessary
- Add automated tests
- Keep the first version practical and not overbuilt

Explicit non-goals:
- metadata scraping
- TMDB or TVDB matching
- advanced renaming
- duplicate detection across the library
- Sonarr or Radarr replacement workflows
- Dockerization
- web UI
- source moves or deletes

Recommended implementation approach:
- Use Python
- Use argparse for CLI parsing
- Use tomllib for config loading
- Use pathlib for path handling
- Use logging for persistent logs
- Use json and csv for structured output
- Use unittest for tests

Expected file targets:
- ./hardlink_organizer.py
- ./config.example.toml
- ./tests/test_hardlink_organizer.py

Inventory fields to support at minimum:
- id
- source_set
- entry_type
- display_name
- real_name
- full_path

Commands to support:
- scan
- list <source_set>
- link <source_set> <entry_id> <dest_set>
- interactive

Behavior details:
- Scan top-level entries only in v1
- Ignore hidden top-level entries by default
- Use deterministic ordering
- Keep display-name cleanup conservative
- Re-check source existence at execution time
- Validate destination root exists before linking
- For collisions, skip and log by default
- Provide preview or dry-run behavior before creating links
- Continue safely through partial failures during recursive linking and print a final summary

Suggested destination name cleanup rules:
- replace dots with spaces
- replace underscores with spaces
- collapse repeated whitespace
- trim surrounding whitespace
- preserve obvious year tokens
- avoid aggressive TV parsing

What to read first:
1. ./README.md
2. ./notes/plans/IMPLEMENTATION_PLAN.md
3. .raiden/state/DECISIONS.md
4. ./AGENTS.md

What to produce:
1. The implementation
2. Example config
3. Tests
4. Any small README adjustments needed to reflect actual commands or usage

Validation expectations:
- Run the test suite and report the command used
- If practical, perform a local temporary-directory smoke test for scan and link behavior
- Summarize any remaining gaps or assumptions

Working style constraints:
- Make the tool safe by default
- Keep functions small and readable
- Avoid hidden side effects
- Avoid introducing unrelated repo changes
- Do not build packaging artifacts yet
- Do not widen scope beyond the v1 brief

Final response requirements:
- Summarize the implemented behavior
- List the key files added or changed
- State what tests were run and whether they passed
- Call out any residual risks or follow-up items
```
