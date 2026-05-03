# Hardlink Organizer Workspace Extraction Plan

Status note:

- The standalone workspace now lives at `/mnt/e/HardlinkOrganizer` in WSL and
  `E:\HardlinkOrganizer` on Windows.
- References in this note to `StarlightDaemonDev/tools/internal/hardlink-organizer/`
  are historical context from the pre-extraction planning phase, not the active
  project root.

This note records the planning approach that was used to move Hardlink Organizer
out of `StarlightDaemonDev/tools/internal/hardlink-organizer/` into its own
top-level workspace and Git repository without losing continuity or shipping a
half-moved state.

## Goal

Promote Hardlink Organizer from a nested project workspace into its own
top-level repository while preserving:

- current code and history state
- local project ledger continuity
- packaging and release assets
- prompt and handoff usability
- a clear pointer back from the parent repository

## Why extraction now makes sense

- the project already has its own roadmap, packaging, prompts, and local ledger
- release and backup needs are now project-specific
- Community Apps and GHCR work are cleaner when the project owns its own root
- future agent work is simpler when the project root and Git root match

## What should happen first

Do these in order:

1. finish local-ledger promotion and local cleanup
2. push a safe backup of the current parent repo state to GitHub
3. choose the new top-level workspace path and repo name
4. copy or move the project into that new location
5. initialize or reconnect Git there
6. update project URLs, packaging metadata, and support links
7. leave a stub or pointer in the parent repository

Do not move the project before a safe backup exists.

## Recommended new workspace shape

Suggested target:

```text
/mnt/e/HardlinkOrganizer/
  agent-ledger/
  agent-prompts/
  engine/
  notes/
  packaging/
  tests/
  webapp/
  README.md
  VERSION
  requirements.txt
  .gitignore
  .dockerignore
```

The project-local `agent-ledger/` should remain the control plane after the move.

## Selected planning defaults

These defaults are now the working plan unless the user changes them later:

### New workspace path

- Confirmed: preferred target workspace path is `/mnt/e/HardlinkOrganizer`

### New repository name

- Confirmed: preferred standalone repository name is `hardlink-organizer`

### Migration method

- Confirmed: preferred extraction method is a simple copy into the new workspace
  followed by a fresh Git repo there
- Inferred: this is the lowest-risk path because the workspace is already mostly
  self-contained and the current priority is safe extraction, not preserving
  fine-grained nested history

### Parent repo aftermath

- Confirmed: the parent repo should keep a short pointer or stub note after the
  move instead of silently dropping the project path

### Model strategy for extraction planning

- Confirmed: ChatGPT is the default planning model for the extraction work
- Confirmed: Gemini 3 Flash is the default model for narrow follow-up audits or
  prompt rewrites related to the move
- Confirmed: Gemini 3.1 Pro is reserved for second-pass review if the extraction
  plan needs a deeper cross-check before execution

## Pre-move checklist

- confirm the parent repo worktree is backed up remotely
- confirm the current Hardlink Organizer workspace is internally coherent
- confirm the desired new repo name and GitHub destination
- confirm whether commit history will be preserved by subtree split, fresh init,
  or plain file copy
- confirm whether the parent repo should keep:
  - a stub README
  - a link to the new repo
  - or a small archived snapshot only

## Migration approaches

### Option 1: simple copy, new repo

Status:
- selected default

Best when:

- speed matters more than preserving nested Git history shape
- the workspace has already become self-contained

Flow:

1. copy this folder to the new location
2. initialize a new Git repo there
3. commit the extracted workspace as its own baseline
4. add the new GitHub remote
5. push

Tradeoff:

- simplest operationally
- loses direct fine-grained commit ancestry unless imported separately

### Option 2: subtree or filtered-history extraction

Status:
- fallback only if preserving project-specific commit ancestry becomes important

Best when:

- preserving project-specific history matters

Flow:

1. split the current parent repo history for this subdirectory
2. create the new repo from that split history
3. push to the new remote

Tradeoff:

- preserves project history better
- more operational risk and more Git complexity

## Files that will need review after extraction

These will need explicit review because they currently assume the parent repo or
current GitHub location:

- `packaging/unraid/templates/hardlink-organizer.xml`
- `packaging/unraid/templates/ca_profile.xml`
- `packaging/unraid/SUPPORT_THREAD_DRAFT.md`
- any GitHub Actions workflow or GHCR image naming that still assumes the parent repo
- any README or prompt path that includes an absolute filesystem path

## Path and URL updates expected after extraction

Update at minimum:

- GitHub project URL
- support URL
- raw asset icon URL
- GHCR image owner or repo path if needed
- any absolute local workspace paths in prompts

### Planned defaults for those updates

- Confirmed: GitHub project URL should move away from the parent repo path and
  point at the new standalone repository once created
- Confirmed: support URL should follow the new standalone repository issues page
- Confirmed: raw asset icon URLs in Unraid template assets will need to stop
  referencing `StarlightDaemonDev/main/tools/internal/hardlink-organizer/...`
- Confirmed: any absolute path in prompt files should be updated from
  `/mnt/e/HardlinkOrganizer` to
  `/mnt/e/HardlinkOrganizer`
- Inferred: GHCR naming may also need to change if the image should publish
  under the standalone repo rather than the parent repo namespace

## Parent repo cleanup after extraction

After the project is successfully moved:

1. replace the old folder contents in the parent repo with a short pointer note
   or remove the folder after the pointer exists elsewhere
2. update the parent repo tool catalog and repo map
3. update any remaining parent-repo ledger references to point at the new repo
4. decide whether the parent repo keeps release notes only or no project copy at all

## Recommended execution order for the actual move

1. backup parent repo to GitHub
2. choose migration method
3. create new workspace
4. move or copy files
5. verify local tests in the new root
6. fix URLs and packaging metadata
7. push new repo
8. update parent repo pointer and catalog docs

## Validation after move

At minimum verify:

- local project ledger reads cleanly from the new root
- prompts no longer rely on the old absolute path
- packaging assets reference the correct project URL
- test commands still work from the new root
- web app and CLI start paths still resolve correctly

## Recommended next action

The GitHub backup checkpoint for the current parent repository state is now the
completed safety boundary.

The next execution step after this planning note is:

1. create `/mnt/e/HardlinkOrganizer`
2. copy the current project workspace there
3. initialize the new repo
4. update URLs and absolute prompt paths
5. verify tests and startup commands from the new root
6. add the parent-repo pointer stub

## Provenance

- Date: 2026-04-16
- Basis: current Hardlink Organizer workspace state, recent local-ledger promotion, and user direction to consider moving the project into its own top-level workspace
- Confidence: high
