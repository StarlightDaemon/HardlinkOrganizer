# Open Loops

Work must be executed one loop at a time.

Bounded prompt slices may be used to advance one loop safely without widening
into adjacent work.

## LOOP-009: drive Hardlink Organizer through Community Apps submission

- Status: open
- Scope: take Hardlink Organizer from local beta and draft Unraid packaging assets through real-host validation, GHCR publication, CA template hardening, dedicated template repository setup, support-thread publication, and formal Community Apps submission
- Readiness: partial
- Evidence plan: use `packaging/unraid/README.md`, `packaging/unraid/CA_PUBLISHING_GUIDE.md`, `packaging/unraid/VALIDATION_CHECKLIST.md`, and the current packaging assets under `packaging/unraid/`
- Validation plan: verify each external dependency is completed in order, the published image and CA template agree, support and project URLs are real, and submission artifacts are captured back into the project ledger
- Closure condition: Hardlink Organizer is submitted to Community Apps and the project ledger records the submission state plus any outstanding review follow-up

## LOOP-010: destination-side naming cleanup

- Status: open (naming-cleanup only — destination registry backend and DestRegistry UI are fully shipped)
- Scope: deliver destination-side naming cleanup workflow. The destination registry backend, validation services, and DestRegistry UI are complete and merged. Only the naming-cleanup sub-feature remains open.
- Readiness: ready
- Evidence plan: use the current implementation under this workspace and real Unraid validation findings already captured in project docs
- Validation plan: verify the feature remains preview-first and audit-friendly, preserves source safety, correctly explains Unraid filesystem constraints, and improves usability without widening destructive power by default
- Closure condition: destination-side naming preview and cleanup are available through the hosted UI with the corresponding backend and documentation support

## Provenance

- Migrated from `agent-ledger/OPEN_LOOPS.md` on 2026-05-03 during RAIDEN Instance install
- Original model: GPT-5 Codex — Date: 2026-04-16

## Migration audit — CLOSED 2026-06-07

- Status: closed
- Scope: WSL→macOS path remediation across all .md, .py, .json, .toml, .sh, .ts, .js files; settings.local.json purge; node_modules ARM64 rebuild; macOS /proc/ degradation comment
- Result: Edict v0.6.1 confirmed clean; all /mnt/e/ references eliminated; commit 0d1e973 pushed to main
