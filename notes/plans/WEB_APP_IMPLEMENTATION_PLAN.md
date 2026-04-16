# Hardlink Organizer Web App Implementation Plan

## Goal

Turn the working Python CLI into a lightweight Unraid-hosted web application with a usable browser workflow for scanning ingress roots, browsing inventory, previewing destinations, validating same-device constraints, and executing hardlinks safely.

## Current baseline

- Current version: `0.1.0`
- Current state: CLI baseline complete and tested
- Next implementation target: `0.2.0` web-app alpha

The next code pass should not start by redesigning the product. It should start from the existing working CLI and turn it into a reusable engine plus first hosted UI.

## Primary product direction

The web UI becomes the primary user interface for v1 release. The existing CLI remains part of the codebase as:

- the execution engine
- a fallback interface
- a debugging and smoke-test path

## Recommended stack

Use a minimal Python web stack that keeps deployment and maintenance simple.

### Recommended backend

- Python
- FastAPI or Flask
- Jinja2 server-rendered templates
- plain HTML, CSS, and small amounts of vanilla JavaScript

### Why this stack

- It keeps the existing Python logic close to the web layer.
- It avoids the complexity of a separate SPA build system for v1.
- It is easier to package for Unraid than a split frontend and backend stack.
- It still allows a polished UI if the templates and CSS are intentional.

### What not to do in this pass

- do not build a React or Next.js frontend unless there is a concrete need
- do not introduce a database
- do not add authentication beyond LAN-local assumptions unless the deployment model forces it
- do not move logic out of Python into JavaScript

## Architectural decision

The current single-file CLI should be split into layers.

## Review-driven next steps

The next pass should begin with a short stabilization slice before the web layer expands.

### Stabilization work that should happen first

- preserve the exact scanned source path instead of eagerly resolving it through `Path.resolve()` so the engine keeps the literal source identity it discovered during scan
- replace deep `sys.exit()` calls in reusable logic with structured errors or exceptions where practical so the web layer can handle failures cleanly
- make command-level validation outcomes machine-usable, including non-zero exit behavior for failed validation paths
- add tests that cover those boundary behaviors before the web layer depends on them

### Why this comes before larger UI work

- the current CLI is good enough for human use, but the web layer needs a cleaner engine boundary
- the current code mixes reusable logic with terminal-oriented control flow
- the next agent should spend effort reducing web-integration risk, not polishing terminal-only behavior

### Layer 1: engine

Move reusable logic into importable Python functions or modules:

- config loading
- inventory scanning
- display-name generation
- index writing
- plan preview generation
- same-device validation
- recursive hardlink execution
- logging helpers

This layer must remain the single source of truth for filesystem behavior.

### Layer 2: CLI wrapper

Keep a thin CLI entrypoint that calls the engine layer.

This preserves:

- direct shell usage
- easier regression testing
- troubleshooting if the web layer breaks

### Layer 3: web backend

Add a lightweight web application that calls the engine layer directly.

Suggested capabilities:

- load and validate config
- list source sets
- run scans
- return inventory for a chosen source set
- build a preview for a selected item and destination set
- execute a confirmed link operation
- return result summaries
- expose recent logs or last-operation details if practical

### Layer 4: web UI

Build a step-by-step interface for:

- selecting a source set
- refreshing or running a scan
- browsing source entries
- selecting a destination set
- editing the suggested destination subpath
- reviewing preview details
- confirming execution
- seeing progress, summary, and errors

## UX requirements

The UI should feel deliberate and practical, not like an admin default page.

### Core screens or panels

- dashboard or landing page
- source set picker
- inventory list with readable names
- details and preview panel
- destination picker
- confirmation dialog or confirmation panel
- result summary area

### UI behavior requirements

- show both `display_name` and the raw `real_name` or raw path on demand
- make validation results obvious before execution
- make dry-run or preview the default first step
- keep dangerous actions explicit
- make errors understandable without inspecting logs

### UI design direction

- clean, high-contrast, purposeful layout
- avoid generic admin dashboard look
- support desktop and tablet widths cleanly
- keep the interaction flow fast and obvious

## Recommended repository shape

```text
./
  README.md
  hardlink_organizer.py
  engine/
    __init__.py
    ...
  webapp/
    app.py
    templates/
    static/
  tests/
    ...
packaging/unraid/
  README.md
  docker/
    ...
```

## HTTP surface recommendation

Keep the server simple and explicit.

### Suggested routes

- `GET /` : main UI
- `GET /health` : basic liveness
- `GET /api/config/sets` : source and destination sets
- `POST /api/scan` : scan all sets or a selected set
- `GET /api/inventory?source_set=<name>` : list items
- `POST /api/preview` : preview a selected link operation
- `POST /api/execute` : perform a confirmed link operation

If server-rendered forms are simpler, direct page routes are also acceptable. The core requirement is safe behavior, not a specific API style.

## Suggested build order

### Step 1: refactor the current tool into reusable engine code

- introduce a stable engine boundary for the existing `0.1.0` CLI logic
- identify code that is currently tied to CLI printing or `sys.exit`
- convert those parts into reusable functions and structured return values
- preserve literal scanned source paths unless canonicalization is explicitly required
- keep the CLI entrypoint working

Done when:
- the web app can import and call the hardlink logic without shelling out
- the engine no longer assumes the caller is a terminal session

### Step 2: add the web backend

- create the web app entrypoint
- wire config loading and engine calls
- add preview and execute handlers
- return structured errors for UI display

Done when:
- browser actions can call backend logic safely

### Step 3: build the browser UI

- create the first page layout
- add source and destination selection
- add inventory rendering
- add preview panel
- add confirm-and-execute flow
- show operation summaries and failures

Done when:
- the full workflow works in a browser without using the terminal

### Step 4: add tests for the web transition

- preserve existing engine tests
- add tests for the stabilization work first
- add tests for web handlers or endpoints
- add smoke tests for preview and execute paths

Done when:
- backend regressions are covered and the web flow has basic verification

### Step 5: add Unraid packaging groundwork

- add packaging docs for hosted deployment
- add Docker assets if that is the chosen Unraid runtime
- document required path mounts, config path, and log persistence

Done when:
- the web app has a documented path to run on Unraid

## Acceptance criteria

- The browser UI can complete scan, browse, preview, and execute flows.
- The backend reuses the existing Python hardlink logic rather than duplicating it.
- Same-device validation remains mandatory.
- The source payload is never moved, renamed, or deleted.
- Destination collisions are skipped and reported.
- The CLI still works after refactoring.
- The web app can be packaged for Unraid with explicit path and persistence documentation.

## Guardrails

- Do not bypass the current validation rules in the web layer.
- Do not execute filesystem actions directly from route handlers without going through the engine layer.
- Do not add library-management features outside the current v1 scope.
- Do not add background auto-import behavior.
- Do not add a database if file-based config and logs are sufficient.
- Do not force a front-end build chain unless it is clearly justified.

## Packaging recommendation for the web pass

For Unraid, the likely best runtime is:

- a lightweight Docker container running the Python web app

with:

- explicit mounts for source roots
- explicit mounts for destination roots
- explicit mount for config and logs

The Docker container is only a packaging method. The product is the local web UI.

## Deliverables expected from the next code agent

- `0.2.0` web-alpha groundwork on top of the `0.1.0` baseline
- refactored engine layer
- working web backend
- working browser UI
- preserved CLI entrypoint
- tests for the new layer boundaries
- Unraid-facing packaging groundwork
- updated README with UI usage and install guidance
