You are the HardlinkOrganizer Instance agent, operating inside /mnt/e/HardlinkOrganizer.

Read first:
- AGENTS.md
- .raiden/README.md
- .raiden/state/CURRENT_STATE.md
- .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md

Current objective:
Verify and commit the Edict v0.4.0 migration files that RAIDEN central wrote into this Instance. Surface one pre-existing anomaly (OPERATING_RULES.md version drift) to the operator for a decision. Do not attempt to fix the anomaly without direction.

Known constraints:
- Do not modify CURRENT_STATE.md, OPEN_LOOPS.md, DECISIONS.md, or WORK_LOG.md.
- Do not push without explicit operator confirmation.
- No Co-Authored-By or agent attribution lines in the commit message.
- Do not run raiden_updater.cli apply — use plan only.
- Do not attempt to fix the OPERATING_RULES.md anomaly or install the hook independently.
- CURRENT_STATE.md is stashed (wip: CURRENT_STATE.md edits) — pop it after Phase 3 commit.

Already true (RAIDEN central wrote these on 2026-05-15):
- Phase 1 commits: 413a46e ("add demo data, config templates, and first-hardlink guide;
  gitignore generated index files") and eb0ddfc ("track RAIDEN prompt slices for backend
  review and security fix loops (70-72)"). Working tree was clean except for this file.
- .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md — new file, v0.4.0 content.
  SHA-256: 1fa98a0ab068349d71556b142d433fe52462de0cca237d773e4e3dc2ad5bdbb0
- .raiden/instance/baseline.json — WORKSPACE_AUDIT_PROTOCOL.md entry added;
  installed_edict_version bumped 0.2.0 → 0.4.0.
  Note: OPERATING_RULES.md hash preserved as bfb99726... (matches installed file content).
- .raiden/instance/metadata.json — installed_edict_version bumped 0.2.0 → 0.4.0.
- .raiden/README.md — ## Workspace Audit section appended.
- .gitignore — canonical audit-output exclusion block appended.

Known anomaly (pre-existing — do NOT fix without operator direction):
- OPERATING_RULES.md in .raiden/writ/ has content hash bfb99726..., which differs from
  the current v0.4.0 package hash 97004e665c2dee... This predates the v0.4.0 migration —
  it was installed at the original v0.2.0 install (2026-05-03).
- .git/hooks/commit-msg is absent.
- Because of these two issues, the plan validator returns Can apply: True instead of
  Already up to date. WORKSPACE_AUDIT_PROTOCOL.md shows [unchanged] — that is the
  v0.4.0 migration success signal.
- Operator decision required: (a) ask RAIDEN central to refresh OPERATING_RULES.md to the
  canonical package content and update the baseline hash, or (b) accept the current content.
  Also decide whether to install the commit-msg hook.

Still open:
1. Run `git status --porcelain` — confirm only migration files appear. Stop if unexpected.
2. Run `grep installed_edict_version .raiden/instance/metadata.json` → expect "0.4.0"
3. Run from /mnt/e/Raiden/toolkit/updater/:
     python3 -m raiden_updater.cli plan \
       --instance /mnt/e/HardlinkOrganizer \
       --package /mnt/e/Raiden/toolkit/updater/fixtures/sample_package
   → WORKSPACE_AUDIT_PROTOCOL.md must show [unchanged].
   → Can apply: True is expected due to pre-existing drift — not a migration failure.
4. Surface anomaly to operator:
   "OPERATING_RULES.md in .raiden/writ/ has content hash bfb99726... vs current package
   hash 97004e66.... Also .git/hooks/commit-msg is absent. WORKSPACE_AUDIT_PROTOCOL.md
   is correctly installed. Decision required: (a) refresh OPERATING_RULES.md via RAIDEN
   central, or (b) accept current content. Hook: install or leave absent?"
5. Commit migration files (do not wait for anomaly resolution):
     .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md
     .raiden/instance/baseline.json
     .raiden/instance/metadata.json
     .raiden/README.md
     .gitignore
     .raiden/local/prompts/audit-protocol-install-handoff.md
   Suggested commit message:
     "install: RAIDEN Edict v0.2.0 → v0.4.0 (WORKSPACE_AUDIT_PROTOCOL install)"
6. Run `git status --porcelain` — confirm clean.
7. Pop the stashed CURRENT_STATE.md:
     git stash pop
   Review and commit when ready.

Do not:
- Modify any managed file in .raiden/writ/ without operator direction
- Attempt to fix the OPERATING_RULES.md or hook anomaly independently
- Run the workspace audit

Close out with:
- result: commit SHA
- evidence checked: git diff output, plan validator WORKSPACE_AUDIT_PROTOCOL.md line, version grep
- remaining risks: OPERATING_RULES.md drift and missing hook — operator decision pending;
  stashed CURRENT_STATE.md to pop and commit
