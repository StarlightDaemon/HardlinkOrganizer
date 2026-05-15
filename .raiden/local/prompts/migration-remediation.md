# Migration Remediation Handoff — HardlinkOrganizer — Edict v0.4.0 Pre-Migration

## Prompt ID

`raiden.shared.handoff.v1`

## Purpose

HardlinkOrganizer's RAIDEN v0.2.0 install was previously committed (first live Instance,
2026-05-03). The v0.3.0 migration was halted because the working tree is dirty: the
tracked file `.raiden/state/CURRENT_STATE.md` has been modified by the operator, and
several other local files are untracked. The RAIDEN central agent cannot write into a
dirty tree. This handoff describes what to resolve before re-running the migration.

## Template

```text
You are continuing a bounded work package inside the current repo.

Read first:
- AGENTS.md
- .raiden/README.md
- .raiden/state/CURRENT_STATE.md (currently modified — review before committing)
- .raiden/instance/metadata.json

Current objective:
- Clean the working tree so the RAIDEN central agent can perform the Edict v0.4.0
  migration (v0.3.0 skipped; v0.4.0 applied directly). This means committing or
  stashing the modified CURRENT_STATE.md and resolving any other dirty-tree items.

Known constraints:
- .raiden/state/CURRENT_STATE.md is operator-curated; review its content before
  committing to ensure it reflects correct current state.
- Do NOT modify any file under .raiden/writ/ — these are RAIDEN-managed.
- Do NOT run the workspace audit.
- Do NOT run raiden_updater.cli apply.
- Commit attribution: no Co-Authored-By or agent attribution lines.

Already true (as of step-2 halt, 2026-05-13):
- RAIDEN v0.2.0 install is committed (commit e34147d, 2026-05-03).
- Dirty tree at halt: M .raiden/state/CURRENT_STATE.md (tracked, modified).
  Other untracked: local prompts, config files, demo_data, docs, index files.
- Current branch: main.
- installed_edict_version in metadata.json: 0.2.0.

Still open:
1. Review .raiden/state/CURRENT_STATE.md changes — confirm the operator edits are
   correct and ready to commit (or stash if the edits are in-progress work).
2. Determine the disposition of other untracked files in the working tree:
   - commit those that belong to the project
   - gitignore or discard those that are scratch/local-only
3. Ensure git status --porcelain is empty before signaling readiness.
4. Signal to the operator: HardlinkOrganizer is ready for the RAIDEN central agent
   to run the v0.4.0 migration prompt from
   /mnt/e/Raiden/toolkit/prompts/audit-protocol-migration-v0.4.0-prompt.md
   targeting --instance /mnt/e/HardlinkOrganizer. (v0.3.0 skipped; v0.4.0 direct.)

Do not:
- reopen settled naming or architecture
- treat review artifacts as canon unless adopted
- broaden the task beyond cleaning the working tree
- run the workspace audit

Close out with:
- result: working tree clean, operator notified RAIDEN central can proceed
- evidence checked: git status --porcelain empty, .raiden/instance/metadata.json
  still shows installed_edict_version 0.2.0
- remaining risks: any untracked operator files whose disposition was deferred
```
