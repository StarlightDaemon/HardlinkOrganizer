# Web App Code Agent Prompt

Use this as the prompt for the next coding agent that should start the hosted web UI and related packaging work.

```text
You are taking over the next implementation phase of Hardlink Organizer.

Repository root:
/mnt/e/HardlinkOrganizer

Read these first:
1. ./README.md
2. ./notes/plans/V1_RELEASE_PLAN.md
3. ./notes/plans/WEB_APP_IMPLEMENTATION_PLAN.md
4. ./hardlink_organizer.py
5. ./tests/test_hardlink_organizer.py
6. .raiden/state/DECISIONS.md
7. ./AGENTS.md

Task:
Start the web-app transition for Hardlink Organizer.

Primary goal:
Build the first working hosted web UI for the tool while preserving the existing Python hardlink logic as the authoritative engine and keeping the CLI operational as a fallback.

Version target for this pass:
- current baseline: `0.1.0`
- target outcome for this pass: `0.2.0` web-app alpha

What exists already:
- a working Python CLI tool
- config loading
- scanning and index writing
- display-name cleanup
- preview generation
- same-device validation
- hardlink execution
- tests for the current CLI and engine logic

Start from that baseline. Do not re-implement the existing CLI from scratch.

What you should build in this pass:
1. Stabilize the current engine boundary for reuse.
2. Refactor the current code so the core logic is importable and reusable from a web app.
3. Preserve the CLI behavior by keeping a thin CLI entrypoint.
4. Add a lightweight Python web backend.
5. Add the first browser UI for the scan -> browse -> preview -> confirm -> execute workflow.
6. Add tests for the stabilization work, refactored engine, and new web layer.
7. Add initial Unraid packaging groundwork for hosting the web app.

Stabilization requirements before broad UI work:
- avoid relying on deep `sys.exit()` calls inside reusable logic
- preserve the exact scanned source path instead of forcing `Path.resolve()` where that would erase the literal discovered path identity
- make validation and execution outcomes easier for non-CLI callers to consume
- keep the current command behavior working after the refactor

Recommended stack:
- Python backend
- FastAPI or Flask
- Jinja2 templates
- minimal JavaScript
- simple CSS without a heavy frontend framework

Do not default to a separate SPA unless there is a strong reason.

Functional requirements:
- show configured source sets
- trigger a scan
- list inventory entries for a selected source set
- show readable display names
- allow inspecting raw names and paths
- choose a destination set
- allow editing the suggested destination subpath
- preview the planned action
- clearly show validation failures
- confirm before execute
- execute the hardlink operation
- show result summary

Safety requirements:
- keep same-device validation mandatory
- never move, rename, or delete the source
- skip existing destination files by default
- do not hardlink directories themselves
- create destination directories normally and link files inside them
- make preview explicit before execution

Architecture requirements:
- do not duplicate core hardlink logic in web handlers
- refactor engine logic into reusable functions or modules
- keep route handlers thin
- keep the CLI usable after the refactor
- keep versioning explicit for the new release phase

Packaging requirements for this pass:
- add initial assets under packaging/unraid/
- document the intended Unraid hosting model
- if you add Docker assets, keep them lightweight and explicit about path mounts
- do not build a full Unraid plugin yet

UI direction:
- make it practical and intentional, not generic admin slop
- support desktop use first, but do not break on tablet or smaller widths
- keep the workflow obvious
- surface validation and risk states clearly
- show raw path details without cluttering the main list

Suggested repository additions:
- ./webapp/
- packaging/unraid/README.md
- packaging/unraid/docker/

Suggested routes or capabilities:
- GET /
- GET /health
- GET or POST handler for source and destination sets
- scan action
- inventory retrieval
- preview action
- execute action

What not to do:
- no TMDB or TVDB matching
- no renaming engine
- no duplicate detection across the full library
- no background auto-import
- no database unless absolutely required
- no full plugin packaging
- no broad unrelated cleanup outside this tool

Validation expectations:
- run the test suite and report the command used
- add tests for the stabilization changes
- add at least basic tests for the web layer
- smoke test the full preview and execute flow locally if practical
- note any assumptions about runtime dependencies

Deliverables:
- updated version markers for the `0.2.0` alpha work if appropriate
- refactored engine code
- working web backend
- working browser UI
- preserved CLI entrypoint
- tests
- packaging groundwork
- updated README

Final response requirements:
- summarize what you implemented
- list key files added or changed
- state what tests you ran and whether they passed
- call out any residual risks or follow-up work
```
