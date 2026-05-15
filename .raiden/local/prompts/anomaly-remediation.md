You are the HardlinkOrganizer Instance agent, operating inside /mnt/e/HardlinkOrganizer.

Read first:
- .raiden/instance/baseline.json
- .raiden/instance/metadata.json

Current objective:
Resolve two pre-existing anomalies left open after the Edict v0.4.0 migration:
  1. OPERATING_RULES.md content drift — installed file (bfb99726) differs from current package (97004e66)
  2. Missing .git/hooks/commit-msg — package expects this hook; it is not installed

Both require RAIDEN central to write files. Your role is to get the operator decision,
signal RAIDEN central, then verify and commit.

Known constraints:
- Do not modify any file under .raiden/writ/ yourself — those writes belong to RAIDEN central.
- Do not push without operator confirmation.
- No Co-Authored-By or agent attribution lines in commit messages.
- CURRENT_STATE.md is unstaged with operator edits — commit it separately, after this task.

─── STEP 1: OPERATOR DECISION ON OPERATING_RULES.md ────────────────────────────

Two options. Ask the operator which to take:

  Option A — Refresh (recommended):
    RAIDEN central overwrites .raiden/writ/OPERATING_RULES.md with the canonical v0.4.0
    package content and updates the baseline.json hash to 97004e66...
    Result: plan validator returns "Already up to date" with no anomalies.

  Option B — Accept current content:
    Leave the installed file (bfb99726...) as-is. RAIDEN central updates baseline.json
    to record bfb99726... as the accepted hash.
    Result: plan validator will still show [update] for OPERATING_RULES.md on every run
    (because the live file never matches the package). This is permanently noisy but not
    broken. Not recommended unless the installed content was intentionally customized.

─── STEP 2: SIGNAL RAIDEN CENTRAL ──────────────────────────────────────────────

Once the operator decides, relay to RAIDEN central:

  "HardlinkOrganizer anomaly remediation requested.
   OPERATING_RULES.md decision: [Option A / Option B]
   Please:
   - [If A] Overwrite .raiden/writ/OPERATING_RULES.md with canonical package content
     and update baseline.json OPERATING_RULES.md hash to 97004e665c2dee6076b2f3b560097067b7cb88aa0f8f4e4a7cf57b22b45e69ac
   - [If B] Update baseline.json OPERATING_RULES.md hash to bfb99726340bae89850bc7e15e75d56ec8da6a95e2300d58d104d5489cdbe847
   - Install .git/hooks/commit-msg from the canonical package payload"

─── STEP 3: VERIFY AFTER RAIDEN CENTRAL CONFIRMS ───────────────────────────────

After RAIDEN central signals completion:

1. Confirm .git/hooks/commit-msg exists and is executable:
     ls -l .git/hooks/commit-msg
   Expected: file present, executable bit set (-rwxr-xr-x or similar)

2. Run from /mnt/e/Raiden/toolkit/updater/:
     python3 -m raiden_updater.cli plan \
       --instance /mnt/e/HardlinkOrganizer \
       --package /mnt/e/Raiden/toolkit/updater/fixtures/sample_package

   If Option A was chosen:
     → expected: Block reason: Already up to date — no changes needed
   If Option B was chosen:
     → OPERATING_RULES.md will still show [update] — that is the accepted state
     → hooks/commit-msg should now show [unchanged]

3. Run git status --porcelain — confirm what files changed:
   If Option A: .raiden/writ/OPERATING_RULES.md and .raiden/instance/baseline.json
   If Option B: .raiden/instance/baseline.json only
   The hook install (.git/hooks/commit-msg) does NOT appear in git status — .git/ is not tracked.

─── STEP 4: COMMIT REMEDIATION FILES ───────────────────────────────────────────

Stage and commit only the files that changed:

  If Option A:
    .raiden/writ/OPERATING_RULES.md
    .raiden/instance/baseline.json
    .raiden/local/prompts/anomaly-remediation.md
  If Option B:
    .raiden/instance/baseline.json
    .raiden/local/prompts/anomaly-remediation.md

  Suggested commit message (Option A):
    "fix: refresh OPERATING_RULES.md to canonical v0.4.0 and install commit-msg hook"
  Suggested commit message (Option B):
    "fix: record accepted OPERATING_RULES.md hash in baseline; install commit-msg hook"

Run git status --porcelain after commit — confirm clean (except CURRENT_STATE.md).

─── STEP 5: COMMIT CURRENT_STATE.md ────────────────────────────────────────────

After the remediation commit:
1. Review .raiden/state/CURRENT_STATE.md — confirm the operator edits are correct.
2. git add .raiden/state/CURRENT_STATE.md
3. git commit -m "state: update CURRENT_STATE.md"

─── STEP 6: PUSH ────────────────────────────────────────────────────────────────

After both commits, confirm with operator before pushing:
"HardlinkOrganizer is now N commits ahead of origin/main. Ready to push when you confirm."

Do not:
- Edit .raiden/writ/OPERATING_RULES.md or .raiden/instance/baseline.json yourself
- Install the hook yourself — that is RAIDEN central's write
- Run the workspace audit

Close out with:
- result: remediation commit SHA, CURRENT_STATE.md commit SHA
- evidence checked: ls -l .git/hooks/commit-msg, plan validator output
- remaining risks: none if Option A; permanent [update] noise in plan if Option B
