# Prompt 07: Root Lock And README Follow-Up Commit

Recommended model:
- Gemini 3 Flash
- Gemini 3.1 Pro if Flash misses the scope boundaries

Recommended mode:
- planning off

## Goal

Close the small follow-up slice identified after the cleanup review by fixing the
remaining README command issue, capturing the intentional root-lock prompt or
agent guidance updates, and committing that bounded docs set locally.

This is a small docs-and-prompt cleanup pass only. Do not widen into more repo
reorganization, feature work, or broad prompt rewriting.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `./README.md`
2. `./AGENTS.md`
3. `.raiden/local/prompts/README.md`
4. `.raiden/local/prompts/micro-prompt-template.md`
5. `.raiden/local/prompts/prompt-00-fresh-chat-ledger-restart.md`
6. `.raiden/local/prompts/prompt-06-recent-cleanup-review-and-scope.md`
7. `.raiden/local/prompts/prompt-07-root-lock-and-readme-followup-commit.md`

Then inspect the working tree before acting.

## Current expected state

Assume the branch already contains:

- commit `57be4c3`:
  - `docs: cleanup README and UI about-strip for public-facing presentation`
- commit `992715d`:
  - `docs: nest planning and legacy prompt docs`

Assume the working tree may currently contain these intended follow-up changes:

- `README.md`
- `AGENTS.md`
- `.raiden/local/prompts/README.md`
- `.raiden/local/prompts/micro-prompt-template.md`
- `.raiden/local/prompts/prompt-00-fresh-chat-ledger-restart.md`
- `.raiden/local/prompts/prompt-06-recent-cleanup-review-and-scope.md`

Verify the actual tree before acting.

## Task

Complete exactly this slice:

1. inspect the working tree and confirm only the expected docs or prompt follow-up is in scope
2. fix the small README command mismatch if it still exists:
   - prefer `python3` where this workspace clearly requires it
3. review the root-lock guidance updates in `AGENTS.md`, the micro prompt, and `prompt-00`
4. register `prompt-06` in the prompt index if it is not already registered
5. make only tiny bounded wording or path fixes needed for coherence
6. commit the resulting docs or prompt cleanup locally with a clear message
7. verify the branch state after the commit

## Scope

In scope:

- small README command correction
- root-lock guidance updates
- prompt index registration for `prompt-06`
- local commit
- local git verification

Out of scope:

- pushing to `origin`
- more root reorganization
- new feature prompts
- broader README rewriting
- changing `.raiden/state/` content
- editing unrelated historical prompt files

## What to check carefully

- whether `README.md` still uses commands that do not work in this workspace
- whether root-lock wording consistently points to `/mnt/e/HardlinkOrganizer`
  and `E:\HardlinkOrganizer`
- whether the micro prompt and `prompt-00` match the current standalone-root rule
- whether `prompt-06` is present and correctly listed in `.raiden/local/prompts/README.md`
- whether any of the touched files drift into broader policy or planning changes

## Constraints

- keep the task tightly bounded
- do not absorb unrelated files into the commit
- do not change prompt intent beyond clarifying root-lock behavior and index accuracy
- if the README command issue is already fixed, do not churn wording unnecessarily

## Acceptable file changes

- `./README.md`
- `./AGENTS.md`
- `.raiden/local/prompts/README.md`
- `.raiden/local/prompts/micro-prompt-template.md`
- `.raiden/local/prompts/prompt-00-fresh-chat-ledger-restart.md`
- `.raiden/local/prompts/prompt-06-recent-cleanup-review-and-scope.md`

## Verification expectations

- run `git status --short --branch`
- review `git diff -- README.md AGENTS.md .raiden/local/prompts/README.md .raiden/local/prompts/micro-prompt-template.md .raiden/local/prompts/prompt-00-fresh-chat-ledger-restart.md .raiden/local/prompts/prompt-06-recent-cleanup-review-and-scope.md`
- inspect the staged diff before committing
- run `git show --stat --oneline --summary HEAD` after the commit
- run `git status --short --branch`

## Final response requirements

- list changed files
- list the exact git and verification commands run
- state whether the local commit succeeded
- state whether anything was intentionally left out of the commit
- call out any residual risk or blocker before a later push
