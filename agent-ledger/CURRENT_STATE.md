# Current State

## Summary

- Confirmed: Hardlink Organizer now operates as its own project workspace rooted at `tools/internal/hardlink-organizer/` with a project-local Agent Ledger.
- Confirmed: the project is at `0.3.0` verification foundation status.
- Confirmed: the hosted web UI and CLI both exist, with verification runs persisted and reviewable.
- Confirmed: the history-driven verification UI slice is closed locally, including browser-triggered verification from prior real link jobs, stored-result review, JSON or CSV exports, and lightweight result filtering.
- Confirmed: Unraid preview now warns about risky mount layouts and recommends shared disk-level or pool-level parent mounts for reliable hardlink execution.
- Confirmed: Community Apps planning notes and Unraid packaging assets are local to this project workspace under `notes/` and `packaging/unraid/`.
- Confirmed: the next bounded `LOOP-010` slice is destination registry and validation backend, with destination-management UI and naming work still pending after that.
- Confirmed: planning can generally assume access to these model families in this workspace context: `Gemini 3.1 Pro (high)`, `Gemini 3.1 Pro (low)`, `Gemini 3 Flash`, `Claude Sonnet 4.6 (thinking)`, `Claude Opus 4.6 (thinking)`, `GPT-OSS-120b`, `GPT-5.4`, `GPT-5.2-Codex`, `GPT-5.1-Codex-Max`, `GPT-5.4-Mini`, `GPT-5.3-Codex`, `GPT-5.2`, and `GPT-5.1-Codex-Mini`.
- Confirmed: a project-local extraction plan now exists for moving Hardlink Organizer into its own top-level workspace and repository when the backup checkpoint is ready.
- Confirmed: the selected extraction defaults are now `/mnt/e/HardlinkOrganizer` as the target workspace path, `hardlink-organizer` as the standalone repo name, and simple copy plus fresh repo init as the preferred migration method.

## Evidence

- Confirmed: `README.md` reports version `0.3.0`, verification foundation status, and `0.4.x` destination management as the next target.
- Confirmed: `webapp/app.py` exposes verification trigger, retrieval, and export routes.
- Confirmed: `notes/VERIFICATION_UI_VALIDATION_NOTE.md` records the route-harness validation approach and passing local test evidence after the `TestClient` issue.
- Confirmed: `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md` and `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md` identify destination management with safe path validation as the next major milestone after verification.
- Confirmed: `agent-prompts/prompt-40-destination-registry-validation-backend.md` defines the current next bounded backend slice under `LOOP-010`.
- Confirmed: the user explicitly listed the generally available Gemini, Claude, GPT-OSS, and GPT-family models in this session.
- Confirmed: `notes/PROJECT_WORKSPACE_EXTRACTION_PLAN.md` records the recommended sequencing, migration options, and post-move validation checklist for a future repo split.
- Confirmed: the user approved moving forward with concrete extraction planning defaults after the backup checkpoint was completed.

## Constraints

- Confirmed: model availability and token ceilings may vary by session even when the planning baseline model pool remains broader.
- Confirmed: each new loop should re-check current model or token status with the user when model choice or handoff strategy could materially affect the work.
- Confirmed: Community Apps publication still depends on external steps including GHCR publication, real host validation, support-thread publication, and template submission.
- Confirmed: full HTTP-level integration coverage remains a separate follow-up because the current local FastAPI dependency stack hangs under `TestClient`.

## Provenance

- Model: GPT-5 Codex
- Reasoning level: structured workspace promotion
- Date: 2026-04-16
- Inputs: current Hardlink Organizer README, notes, prompts, webapp code, and user-provided model availability note
- Confidence: high
