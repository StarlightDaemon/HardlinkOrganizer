# Prompt 00: Fresh Chat Ledger Restart

Recommended model:
- Claude Sonnet 4.6 (thinking)

Recommended mode:
- planning on

## Goal

Start a fresh chat on this repository with minimal prior context and continue work
by executing exactly one ledger-defined task or one explicitly named project slice.

The new agent must rebuild only the context needed for the selected task, not the
entire project history.

## Repository root

`/mnt/e/HardlinkOrganizer`

Windows path:

`E:\HardlinkOrganizer`

Hard stop rule:

- if the active working directory is the old nested copy under
  `StarlightDaemonDev/tools/internal/hardlink-organizer`, stop and switch to the
  standalone root before continuing

## First read

Read these files first and keep the context narrow:

1. `.raiden/README.md`
2. `.raiden/state/CURRENT_STATE.md`
3. `.raiden/state/OPEN_LOOPS.md`
4. `.raiden/state/WORK_LOG.md`

Then read only the files directly relevant to the selected task.

## Task selection rule

Work on exactly one of the following:

- one `LOOP-xxx` item from `.raiden/state/OPEN_LOOPS.md`
- one specific project planning file in `.raiden/state/`
- one specific prompt file under `.raiden/local/prompts/`

Do not combine multiple ledger tasks in one pass unless the selected task explicitly
requires it.

## Current project focus

Hardlink Organizer is a Dockerized Unraid-focused web app for safe hardlink planning,
execution, and future verification workflows.

Important current realities:

- a first working Unraid beta has been validated
- true hardlinks were confirmed on a real Unraid host by matching inode numbers
- `/mnt/user` and separate source or destination bind mounts can produce misleading
  preview success and real `EXDEV` failures
- shared disk-level parent mounts are currently the reliable execution pattern

## Default priority if the user does not specify a task

Use this order:

1. `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`
2. `.raiden/local/prompts/prompt-20-unraid-preflight-hardening.md`
3. `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`
4. `notes/COMMUNITY_APPS_ROADMAP.md`

If no task is explicitly named, default to the highest-priority unfinished Hardlink
Organizer task.

## Working rules

- stay scoped to one task
- prefer reading only the files needed for that task
- preserve the current product boundary:
  - Hardlink Organizer is primarily a hardlink-focused operational tool
  - it is not intended to replace stronger external cataloging or media renaming tools
- keep everything preview-first and safe-by-default
- update the relevant ledger files when the selected task materially changes project state

## If the selected task is implementation work

Before changing code:

- identify the minimum files involved
- state the intended bounded change
- prefer tests or smoke verification for the changed area

If the task is planning-only:

- update only the relevant ledger or planning docs
- do not widen into implementation

## Required final response

The new agent should end with:

- the selected task
- changed files
- what was completed
- what was verified
- any remaining blockers or next-step recommendation

## Recommended invocation pattern

When using this prompt in a new chat, append one short task directive after it, for example:

- `Selected task: .raiden/local/prompts/prompt-20-unraid-preflight-hardening.md`
- `Selected task: LOOP-010`
- `Selected task: notes/COMMUNITY_APPS_ROADMAP.md stage 3 planning`

## Provenance

- Date: 2026-04-16
- Basis: current local project ledger, current Hardlink Organizer state, and the need for fresh-chat continuation with narrow context
- Confidence: high
