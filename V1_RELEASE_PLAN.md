# Hardlink Organizer v1 Release Plan

## Release decision

The best v1 release format for this tool is:

- Primary: lightweight Unraid-hosted web UI
- Supporting engine: the existing Python CLI and link engine
- Optional host access: direct CLI use for debugging and fallback

This should be treated as a web application release, not as a CLI-only release.

## Version targets

- Current baseline: `0.1.0`
- Meaning of `0.1.0`: tested CLI engine and terminal workflow are complete enough to serve as the backend baseline
- Next target: `0.2.0`
- Meaning of `0.2.0`: first hosted web-app alpha with engine extraction, basic browser workflow, and initial Unraid packaging groundwork
- Target after that: `0.3.0`
- Meaning of `0.3.0`: Unraid-focused beta with packaging, install docs, and real-host validation tightened

## Why this is the right v1 format

The user-facing need is now clear: a hosted page with a usable interface, not a shell-first workflow. The current Python implementation is still valuable, but it should become the execution engine behind a small local web app rather than remain the primary interface.

### Reasons to prefer a web UI for v1

- The workflow is inherently step-by-step and maps well to a browser-based selection flow.
- Inventory browsing, numbered selection, destination preview, and confirmation are all easier to use in a UI than in terminal prompts.
- A web UI reduces operator friction for repeated use on Unraid.
- The existing Python logic can remain the safety-critical backend layer.

### Why the current CLI should remain part of the architecture

- The current code already encodes the filesystem validation and hardlink behavior.
- The CLI remains useful for smoke tests, fallback operation, and low-level debugging.
- Separating engine logic from UI now will make later packaging less risky.

### Docker clarification

If this ships on Unraid as a web app, Docker is still a normal packaging option and is not a VM. The important distinction is architectural:

- not a heavy VM-style deployment
- not a background service with unnecessary complexity
- yes to a lightweight local web app if it cleanly exposes the host paths needed for safe hardlinking

The key risk is not Docker itself. The key risk is bad path mapping or permissions. The backend must still validate devices at runtime.

## Recommended v1 release shape

### Canonical artifact

A release bundle that contains:

- `backend/` or equivalent Python application code
- `web/` or equivalent UI assets
- `config.example.toml`
- `README.md`
- `V1_RELEASE_PLAN.md`
- container or host-launch packaging files
- optional CLI wrapper for maintenance and fallback

### Expected install outcome on Unraid

- A local web page reachable on the LAN
- A persistent config location
- Persistent log output
- Mounted or otherwise accessible source and destination roots
- Optional CLI entrypoint retained for local troubleshooting

## Recommended v1 architecture

### Layer 1: hardlink engine

Keep the current Python logic as the authoritative backend for:

- config loading
- scanning
- inventory generation
- display-name cleanup
- same-device validation
- recursive hardlink execution
- logging

This layer should be refactored into importable functions if needed, rather than duplicated in web handlers.

### Layer 2: lightweight web backend

Add a minimal HTTP application that exposes controlled endpoints or server-side actions for:

- listing source sets
- scanning a source set
- listing inventory entries
- previewing a link plan
- executing a confirmed link action
- returning recent logs or operation summaries

This backend should remain LAN-local and explicit in behavior.

### Layer 3: browser UI

Add a simple but intentional UI for:

- source set selection
- inventory browsing
- readable display names with raw path detail available
- destination set selection
- editable suggested destination folder
- preview panel
- confirmation step
- result summary and error display

## v1 packaging targets

### Target 1: lightweight local web app

This is the primary supported mode.

Best fit for Unraid:

- a small web service packaged for easy local hosting
- most likely as a lightweight Docker container or equally lightweight host process

### Target 2: direct CLI use

This remains supported, but as a secondary interface.

Good fits:

- debugging
- backend smoke tests
- recovery use if the web layer has issues

### Target 3: User Scripts integration

This remains optional for scheduled scans or maintenance helpers, but it is not the main UI path.

## v1 release goals

- Make the tool usable from a normal browser on the local network
- Preserve the current safe backend behavior
- Keep config persistent and inspectable
- Keep log location explicit
- Make rollback simple
- Avoid turning the system into a heavy platform or VM-style service

## v1 release criteria

The tool is ready for a v1 release when all of the following are true.

### Functional criteria

- the UI can scan, browse, preview, confirm, and execute link operations
- the underlying backend still writes structured inventory output
- same-device validation blocks invalid hardlink attempts
- recursive directory linking works
- collisions are skipped and logged
- preview behavior is trustworthy

### Packaging criteria

- installation can be completed with a single documented procedure
- config file location is stable and explicit
- mounted source and destination paths are documented clearly
- the hosted UI is reachable locally with minimal setup
- uninstall leaves no unclear residue beyond user-created logs and config unless documented

### Documentation criteria

- README includes install steps for the hosted UI
- README includes first-run config steps
- README includes a short safety section about `/mnt/user` and same-device validation
- README includes screenshots or at least UI flow descriptions
- packaging docs describe CLI fallback and optional User Scripts usage

### Verification criteria

- automated tests pass
- a manual smoke test is completed on a real or realistic Unraid-like filesystem layout
- the web flow produces the same safe execution behavior as direct backend invocation

## Release work breakdown

### Phase A: separate engine from interface cleanly

- keep the existing hardlink and validation logic as a reusable backend module
- remove assumptions that the only caller is the terminal UI
- preserve CLI behavior while exposing backend functions to the web layer

Done when:
- the web backend can reuse the existing logic without reimplementing it

### Phase B: build the local web backend and UI

- add a small HTTP app
- add routes or handlers for scan, list, preview, and execute
- add a browser UI for the step-by-step workflow
- keep preview and confirm explicit

Done when:
- a user can complete the end-to-end workflow from a browser

### Phase C: package for Unraid hosting

- add `packaging/unraid/README.md`
- add packaging assets for a lightweight hosted deployment
- document config, log, and path-mount expectations
- document local-network access expectations

Done when:
- the app can be started and reached on Unraid with a clear documented procedure

### Phase D: create a release artifact

- create a versioned release bundle
- include install and upgrade guidance
- keep CLI fallback available

Done when:
- the tool can be distributed and installed without requiring direct repo use

## Proposed repository additions for the v1 release pass

```text
packaging/unraid/
  README.md
  docker/
  templates/
web/
  ...
```

## Release recommendation by format

### Web UI hosted locally

Recommendation: yes, this should be the official v1 release.

### Lightweight Docker container

Recommendation: yes, likely the best Unraid packaging method if it keeps path mapping and persistence explicit.

This is not a VM-style deployment. It is simply the most normal way to host a local web app on Unraid.

### Native CLI

Recommendation: yes, keep it as a supported secondary interface and backend fallback.

### User Scripts integration

Recommendation: optional only, mainly for scans or maintenance jobs.

### Full Unraid plugin

Recommendation: no for v1 release.

That would add packaging and lifecycle complexity before the web workflow has enough operational history.

## Open release risks

- Bad container path mappings could make the UI confusing or unsafe if not documented clearly.
- Some users may assume `/mnt/user` paths are always link-compatible despite the validation rules.
- The current codebase may need refactoring so backend logic can be called cleanly from HTTP handlers.
- Persistent config and log path choices must be explicit.
- A web UI can encourage more casual clicking, so preview and confirmation guardrails matter more.

## Risk mitigation

- keep the config file explicit and editable
- keep same-device validation non-optional
- make preview and confirmation mandatory before execution
- document every required host path mount clearly
- keep the CLI available for debugging and validation

## Concrete recommendation

Release v1 as a lightweight Unraid-hosted web app with:

- the existing Python logic retained as the execution engine
- a small browser UI for the full step-by-step workflow
- explicit config and log persistence
- clear host path mapping documentation
- CLI fallback retained for maintenance and debugging

Do not release v1 as a full Unraid plugin, and do not discard the CLI backend.
