# Legacy Review

These repo-local agent surfaces predate the current RAIDEN Instance layout.
All three detected legacy artifacts have been resolved as of 2026-05-03.

## Resolved Legacy Artifacts

- `AGENTS.md`
  Status: `resolved`
  Resolved: 2026-05-03
  Action: Merged into RAIDEN-aware form. Legacy copy preserved at `.raiden/local/legacy/AGENTS.legacy.md`. The repo-root `AGENTS.md` now bridges to `.raiden/README.md` and the `.raiden/state/` control plane.

- `agent-ledger`
  Status: `resolved`
  Resolved: 2026-05-03
  Action: All state files (CURRENT_STATE, GOALS, OPEN_LOOPS, DECISIONS, WORK_LOG) migrated to `.raiden/state/`. Original content preserved in git history. The `agent-ledger/` directory has been retired and removed from the working tree.

- `agent-prompts`
  Status: `resolved`
  Resolved: 2026-05-03
  Action: All prompt files moved to `.raiden/local/prompts/`. Legacy handoff and index docs moved to `.raiden/local/prompts/legacy/`. The `agent-prompts/` directory has been retired and removed from the working tree.

## Notes

This file is retained as a migration record. No further legacy review action is required unless new pre-RAIDEN artifacts are discovered.
