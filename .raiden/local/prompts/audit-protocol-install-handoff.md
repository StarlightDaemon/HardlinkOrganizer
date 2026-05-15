You are the HardlinkOrganizer Instance agent, operating inside /mnt/e/HardlinkOrganizer.

Read first:
- AGENTS.md
- .raiden/README.md
- .raiden/state/CURRENT_STATE.md
- .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md

Current objective:
Verify and commit the Edict v0.4.0 migration files that RAIDEN central wrote into this Instance. No new writes are needed — RAIDEN central completed all file operations and all anomalies are resolved; your task is verification and commit only.

Known constraints:
- Do not modify CURRENT_STATE.md, OPEN_LOOPS.md, DECISIONS.md, or WORK_LOG.md.
- Do not push without explicit operator confirmation.
- No Co-Authored-By or agent attribution lines in the commit message.
- Do not run raiden_updater.cli apply — use plan only.
- CURRENT_STATE.md is stashed (wip: CURRENT_STATE.md edits) — pop it after this commit.

Already true (RAIDEN central wrote these on 2026-05-15; baseline corrected 2026-05-15):
- Phase 1 commits: 413a46e and eb0ddfc. Working tree was clean except for this file.
- .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md — new file, v0.4.0 content.
  SHA-256: 1fa98a0ab068349d71556b142d433fe52462de0cca237d773e4e3dc2ad5bdbb0
- .raiden/instance/baseline.json — WORKSPACE_AUDIT_PROTOCOL.md entry added;
  installed_edict_version bumped 0.2.0 → 0.4.0; OPERATING_RULES.md hash corrected
  to 97004e66... (canonical — prior anomaly resolved by operator).
- .raiden/instance/metadata.json — installed_edict_version bumped 0.2.0 → 0.4.0.
- .raiden/README.md — ## Workspace Audit section appended.
- .gitignore — canonical audit-output exclusion block appended.
- plan validator confirms: Block reason: Already up to date — no changes needed.
  No anomalies, no conflicts — fully clean.

Still open:
1. Run `git status --porcelain` — confirm only migration files appear. Stop if unexpected.
2. Run `grep installed_edict_version .raiden/instance/metadata.json` → expect "0.4.0"
3. Run from /mnt/e/Raiden/toolkit/updater/:
     python3 -m raiden_updater.cli plan \
       --instance /mnt/e/HardlinkOrganizer \
       --package /mnt/e/Raiden/toolkit/updater/fixtures/sample_package
   → expect: Block reason: Already up to date — no changes needed
4. Commit the following files:
     .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md
     .raiden/instance/baseline.json
     .raiden/instance/metadata.json
     .raiden/README.md
     .gitignore
     .raiden/local/prompts/audit-protocol-install-handoff.md
   Suggested commit message:
     "install: RAIDEN Edict v0.2.0 → v0.4.0 (WORKSPACE_AUDIT_PROTOCOL install)"
5. Run `git status --porcelain` after commit — confirm clean.
6. Pop the stashed CURRENT_STATE.md:
     git stash pop
   Review and commit when ready.

Do not:
- Modify any managed file in .raiden/writ/
- Run the workspace audit

Close out with:
- result: commit SHA
- evidence checked: git diff output, plan validator output, version grep
- remaining risks: stashed CURRENT_STATE.md to pop and commit; none others
