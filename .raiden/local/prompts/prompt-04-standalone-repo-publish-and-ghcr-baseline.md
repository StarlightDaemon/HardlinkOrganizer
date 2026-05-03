# Prompt 04: Standalone Repo Publish And GHCR Baseline

Recommended model:
- Gemini 3 Flash

Recommended mode:
- planning off

## Goal

Finish the first standalone-repository publication pass for Hardlink Organizer by
committing the already-prepared repo fixes, pushing them to `main`, and verifying
that the standalone GitHub repository now has the expected workflow and packaging
baseline for later GHCR publication.

This is a bounded repo-publication pass, not broader release or feature work.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `./README.md`
2. `./VERSION`
3. `.raiden/state/CURRENT_STATE.md`
4. `./notes/COMMUNITY_APPS_ROADMAP.md`
5. `./packaging/unraid/README.md`
6. `./.github/workflows/hardlink-organizer-image.yml`

## Current expected state

Assume the standalone repository already exists at:

- GitHub repo: `https://github.com/StarlightDaemon/HardlinkOrganizer`
- local root: `/mnt/e/HardlinkOrganizer`

Assume these local changes may already be present but uncommitted:

- restored GHCR workflow under `.github/workflows/`
- version alignment from `0.2.1` to `0.3.0`
- packaging metadata updates to match the standalone repository

Verify the actual local state before acting.

## Task

Complete exactly this slice:

1. inspect `git status` and confirm the standalone repo state
2. review the pending workflow and version-alignment changes for obvious mistakes
3. commit the bounded publication-baseline changes with a clear commit message
4. push `main` to `origin`
5. verify that:
   - `main` is clean and tracking `origin/main`
   - `.github/workflows/hardlink-organizer-image.yml` exists on GitHub
   - the repo is ready for the later GHCR publication step defined in `notes/COMMUNITY_APPS_ROADMAP.md`

## Scope

In scope:

- local git status review
- small bounded fixes if the workflow or packaging metadata is still inconsistent
- commit and push of the current standalone-repo publication baseline
- verification that the pushed repo contains the GHCR workflow and coherent `0.3.0` markers

Out of scope:

- new feature work
- destination-management work
- Community Apps submission
- dedicated template repository creation
- support-thread publication
- branch protection or other GitHub settings work unless directly required to finish the push
- broad refactors or documentation rewrites

## What to check carefully

- `hardlink_organizer.py` version matches the intended release baseline
- `tests/test_hardlink_organizer.py` expects the same version
- `packaging/unraid/` docs and template version markers do not still claim `0.2.1`
- `.github/workflows/hardlink-organizer-image.yml` builds from the repo root using `packaging/unraid/docker/Dockerfile`
- the workflow is configured to push to `ghcr.io/<owner>/hardlink-organizer`

## Constraints

- keep the change set bounded to repo publication readiness
- do not introduce new roadmap work
- do not rewrite historical prompt files just to eliminate old `0.2.1` references
- if the push requires credentials, use the already-configured machine auth rather than inventing a new auth path
- if a required verification step cannot be completed locally, state the exact blocker and stop

## Acceptable file changes

- `./.github/workflows/hardlink-organizer-image.yml`
- `./hardlink_organizer.py`
- `./tests/test_hardlink_organizer.py`
- `./packaging/unraid/README.md`
- `./packaging/unraid/VALIDATION_CHECKLIST.md`
- `./packaging/unraid/SUPPORT_THREAD_DRAFT.md`
- `./packaging/unraid/templates/hardlink-organizer.xml`
- `./packaging/unraid/docker/Dockerfile`
- `./packaging/unraid/docker/docker-compose.yml`
- `.raiden/local/prompts/README.md` only if you add or register this prompt file

## Verification expectations

- run `git status --short --branch`
- run `git branch -vv`
- inspect the final commit contents before pushing
- push to `origin main`
- verify the post-push branch state locally
- if network tools are available, confirm the workflow file is present on GitHub after push

## Final response requirements

- list changed files
- list the exact git and verification commands run
- state whether the push to `origin/main` succeeded
- state whether the standalone repo now has the GHCR workflow baseline in place
- call out any remaining blocker before the later GHCR image publication step
