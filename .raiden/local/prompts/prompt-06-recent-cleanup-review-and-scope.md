# Prompt 06: Recent Cleanup Review And Scope Check

Recommended model:
- Gemini 3.1 Pro

Recommended mode:
- planning on

## Goal

Do a bounded review of the recent Hardlink Organizer cleanup work before any
more restructuring or feature work continues.

This is a review-and-scope pass only. The purpose is to inspect what was just
done, identify any regressions or overreach, and recommend whether the current
direction should continue as-is, be tightened, or be partially corrected before
new work lands.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `./README.md`
2. `.raiden/local/prompts/README.md`
3. `./notes/README.md`
4. `./notes/plans/README.md`
5. `.raiden/local/prompts/legacy/README.md`
6. `.raiden/local/prompts/prompt-05-readme-and-about-cleanup-push.md`
7. `.raiden/local/prompts/micro-prompt-template.md`

Then inspect the recent git history and the current working tree.

## Review target

Focus on these recent cleanup results:

- commit `57be4c3`:
  - `docs: cleanup README and UI about-strip for public-facing presentation`
- commit `992715d`:
  - `docs: nest planning and legacy prompt docs`

Assume the branch may still contain unrelated uncommitted changes in:

- `AGENTS.md`
- `.raiden/local/prompts/micro-prompt-template.md`
- `.raiden/local/prompts/prompt-00-fresh-chat-ledger-restart.md`

Treat those uncommitted files as out of scope unless they directly block your
ability to review the cleanup work above.

## Task

Complete exactly this slice:

1. inspect the current branch and working tree so you know what is committed versus still dirty
2. review the public-facing README and UI-about cleanup for obvious mistakes, misleading copy, or workflow regressions
3. review the root-doc nesting and prompt or notes reorganization for broken paths, confusing structure, or overreach
4. identify concrete findings first, with file or commit references
5. recommend the smallest sensible next step before more cleanup or feature work continues

## Scope

In scope:

- review of the README/about cleanup
- review of the root cleanup and nested docs layout
- review of prompt and notes discoverability after the nesting pass
- identifying broken references, confusing organization, or unnecessary churn
- recommending whether to continue, pause, or correct specific items next

Out of scope:

- implementing feature work
- broad README rewriting
- new visual redesign
- destination-management backend work
- packaging or GHCR work
- committing or pushing new cleanup by default
- rewriting unrelated prompt files just because they are old

## What to check carefully

- whether `README.md` is now short, accurate, and still useful as the repo front page
- whether the UI-about cleanup still matches the actual project state
- whether the root now contains the right entry files and not too much planning clutter
- whether `notes/`, `notes/plans/`, `.raiden/local/prompts/`, and `.raiden/local/prompts/legacy/` are easy to understand without digging
- whether any active prompt still points to pre-move root paths
- whether the cleanup commits introduced structure that is neat locally but confusing for future contributors or agent handoffs

## Constraints

- keep this as a review pass, not a new implementation pass
- prefer findings and recommendations over edits
- if you notice unrelated dirty files, do not absorb them into your scope
- if a possible issue is only speculative, say so clearly instead of overstating it

## Acceptable file changes

Prefer no file changes.

If you believe one tiny direct fix is absolutely necessary to make the cleanup
review coherent, call it out explicitly and explain why it could not reasonably
wait for a follow-up. Otherwise, do not edit files.

## Verification expectations

- run `git status --short --branch`
- run `git log --oneline -5`
- inspect `git show --stat 57be4c3`
- inspect `git show --stat 992715d`
- inspect diffs or file contents for the moved docs and prompt indexes
- search for stale references to the old root paths if needed

## Final response requirements

- list findings first, ordered by severity, with file or commit references
- state explicitly if you found no significant issues
- summarize the current cleanup scope in 1 short paragraph
- recommend the next bounded step before more work continues
- state what you verified and what remains unverified
