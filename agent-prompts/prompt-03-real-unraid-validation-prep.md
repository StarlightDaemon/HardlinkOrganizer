# Prompt 03: Real Unraid Validation Prep

Prepare Hardlink Organizer for a real-host validation pass. This is a documentation and checklist task only.

Repository root:
`/mnt/e/HardlinkOrganizer`

Read first:
1. `./README.md`
2. `packaging/unraid/README.md`
3. `./V1_RELEASE_PLAN.md`

Task:
Create or refine a concise real-host validation checklist for Unraid so the next manual validation run is disciplined and reproducible.

Must cover:
- config path setup
- source and destination mount checks
- same-device verification expectations
- preview-before-execute workflow
- dry-run check
- true hardlink inode check
- collision handling check
- log and DB verification

Do not:
- change engine code
- change web UI code
- add packaging features

Final response:
- list changed files
- provide the exact checklist location
- summarize what a human operator should verify on the Unraid host
