# Open Loops

Work must be executed one loop at a time.

Bounded prompt slices may be used to advance one loop safely without widening
into adjacent work.

## LOOP-009: drive Hardlink Organizer through Community Apps submission

- Status: open
- Scope: take Hardlink Organizer from local beta and draft Unraid packaging assets through real-host validation, GHCR publication, CA template hardening, dedicated template repository setup, support-thread publication, and formal Community Apps submission
- Readiness: partial
- Evidence plan: use `notes/COMMUNITY_APPS_ROADMAP.md`, `packaging/unraid/README.md`, `packaging/unraid/CA_PUBLISHING_GUIDE.md`, `packaging/unraid/VALIDATION_CHECKLIST.md`, and the current packaging assets under `packaging/unraid/`
- Validation plan: verify each external dependency is completed in order, the published image and CA template agree, support and project URLs are real, and submission artifacts are captured back into the project ledger
- Closure condition: Hardlink Organizer is submitted to Community Apps and the project ledger records the submission state plus any outstanding review follow-up

## LOOP-010: expand Hardlink Organizer with destination management and later naming workflows

- Status: open
- Scope: implement the next major product features for Hardlink Organizer after the completed verification foundation, including destination management in the web UI, destination registry and validation services, destination-side naming cleanup, and related Unraid-specific safety improvements
- Readiness: ready
- Evidence plan: use `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`, `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md`, the current implementation under this workspace, and real Unraid validation findings already captured in project docs
- Validation plan: verify each feature remains preview-first and audit-friendly, preserves source safety, correctly explains Unraid filesystem constraints, and improves usability without widening destructive power by default
- Closure condition: safe destination management and naming preview are available through the hosted UI with the corresponding backend, validation, and documentation support

## Provenance

- Model: GPT-5 Codex
- Reasoning level: structured workspace promotion
- Date: 2026-04-16
- Inputs: existing repo-level Hardlink Organizer loop records, current project roadmap notes, and user direction to give this project its own ledger
- Confidence: high
