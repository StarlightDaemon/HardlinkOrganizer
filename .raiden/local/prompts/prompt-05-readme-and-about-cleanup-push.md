# Prompt 05: README And About Cleanup Push

Recommended model:
- Gemini 3 Flash

Recommended mode:
- planning off

## Goal

Finish the bounded README and UI-about cleanup pass for Hardlink Organizer by
reviewing the already-prepared changes, committing them, pushing them to
`origin/main`, and confirming the remote repository now reflects the lighter
public-facing presentation.

This is a commit-and-push slice only. Do not widen into feature work, packaging
work, or broader product restructuring.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `./README.md`
2. `./webapp/templates/index.html`
3. `./webapp/static/style.css`
4. `.raiden/local/prompts/README.md`
5. `.raiden/local/prompts/micro-prompt-template.md`

## Current expected state

Assume this cleanup has already been prepared locally and is waiting to be
reviewed, committed, and pushed.

Expected local changes:

- `README.md` is much shorter and more appropriate for a local project with
  GitHub used mainly for testing
- `webapp/templates/index.html` includes a compact static about or hero strip
- `webapp/static/style.css` includes visual cleanup and stronger layout styling

Verify the actual working tree before acting.

## Task

Complete exactly this slice:

1. inspect the working tree and confirm only the intended README/about cleanup is in scope
2. review the three changed files for obvious mistakes, overreach, or broken copy
3. make only small bounded fixes if needed
4. commit the cleanup with a clear message
5. push `main` to `origin`
6. verify that the branch is clean and still tracking `origin/main`

## Scope

In scope:

- README cleanup review
- web UI about or hero section review
- small copy or layout corrections directly tied to that cleanup
- commit and push
- local git verification after push

Out of scope:

- workflow or GHCR work
- Community Apps work
- destination-management work
- backend changes
- JavaScript workflow rewrites
- broader visual redesign beyond the current about-strip cleanup

## What to check carefully

- `README.md` now reads as a short public-facing project front page
- the README does not lead with internal ledger or roadmap detail
- the new UI copy matches the repo's actual current state:
  - local project
  - GitHub mainly for testing
  - not a polished public release
- the new hero/about layout does not remove or break the main workflow shell
- the styling change still looks coherent on desktop and narrow layouts

## Constraints

- keep the task tightly bounded to the prepared cleanup
- do not widen into app behavior changes
- do not rewrite unrelated docs
- do not touch historical prompt files unless needed to register a new prompt
- if visual verification cannot be completed locally, say so plainly and stop at code review plus git verification

## Acceptable file changes

- `./README.md`
- `./webapp/templates/index.html`
- `./webapp/static/style.css`
- `.raiden/local/prompts/README.md` only if you need to register this prompt

## Verification expectations

- run `git status --short --branch`
- review `git diff -- README.md webapp/templates/index.html webapp/static/style.css`
- inspect the final commit contents before pushing
- push to `origin main`
- run `git status`
- run `git branch -vv`

## Final response requirements

- list changed files
- list the exact git and verification commands run
- state whether the push to `origin/main` succeeded
- state whether any visual verification was completed or remains unverified
- call out any residual risk in the README/about cleanup
