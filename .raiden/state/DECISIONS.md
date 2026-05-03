# Decisions

## DEC-001: use a project-local RAIDEN Instance as the control plane

- Date: 2026-05-03
- Status: active
- Confirmed: RAIDEN Instance installed; control plane migrated from `agent-ledger/` to `.raiden/state/`. Supersedes the earlier Agent Ledger model (original DEC-001).
- Impact: future Hardlink Organizer planning and execution should start from `.raiden/state/` inside this workspace.

## DEC-002: keep Hardlink Organizer hardlink-focused

- Date: 2026-04-16
- Status: active
- Confirmed: the current project README and roadmap keep hardlink planning, execution, verification, and safe destination handling as the product boundary.
- Inferred: metadata scraping, full cataloging, and aggressive renaming should remain subordinate or out of scope unless the user explicitly expands the mission later.
- Impact: feature work should favor safe hardlink workflows, auditability, and Unraid correctness over broader media-management ambitions.

## DEC-003: keep the hosted web UI as the primary release shape with CLI fallback

- Date: 2026-04-16
- Status: active
- Confirmed: the current implemented project state already includes a hosted web UI and still preserves the CLI.
- Impact: new user-facing work should land in the web app first unless the task is clearly backend-only or CLI maintenance.

## DEC-004: use a staged Community Apps path instead of a one-shot submission

- Date: 2026-04-16
- Status: active
- Confirmed: Community Apps publication still depends on external prerequisites including real-host validation, public image publication, template hardening, and support-thread publication.
- Impact: `LOOP-009` should continue to advance one stage at a time through the local roadmap and packaging docs.

## DEC-005: prefer shared disk-level or pool-level parent mounts for real Unraid execution

- Date: 2026-04-16
- Status: active
- Confirmed: `/mnt/user` paths and separate container bind mounts can preview as safe while still failing real hardlink execution with `EXDEV`.
- Impact: preview, validation, docs, and destination-management features should keep surfacing this Unraid-specific constraint.

## DEC-006: use the user-provided model pool as the default planning baseline

- Date: 2026-04-16
- Status: active
- Confirmed: baseline model pool includes `Gemini 3.1 Pro (high/low)`, `Gemini 3 Flash`, `Claude Sonnet 4.6 (thinking)`, `Claude Opus 4.6 (thinking)`, `GPT-OSS-120b`, `GPT-5.4`, `GPT-5.2-Codex`, `GPT-5.1-Codex-Max`, `GPT-5.4-Mini`, `GPT-5.3-Codex`, `GPT-5.2`, `GPT-5.1-Codex-Mini`.
- Impact: model recommendations should favor the cheapest adequate model; each new loop should re-check current token or model status when it could affect scope or handoff.

## DEC-007: keep minimal repo-tooling files local so the workspace can stand on its own

- Date: 2026-04-16
- Status: active
- Impact: local prompt roots, ignore files, and state references should point at this workspace rather than assuming a parent repository root.

## DEC-008: workspace is `/mnt/e/HardlinkOrganizer`; standalone repo name is `hardlink-organizer`

- Date: 2026-04-16
- Status: active
- Confirmed: simple copy plus fresh Git initialization is the default migration method.
- Impact: any future extraction execution pass should optimize for a clean standalone root and correct URLs.

## DEC-009: leave a pointer stub in the parent repository after any future extraction

- Date: 2026-04-16
- Status: active
- Impact: the post-move cleanup pass should include a parent-repo stub update to avoid silent removal of the old path.

## Provenance

- Migrated from `agent-ledger/DECISIONS.md` on 2026-05-03 during RAIDEN Instance install
- Original model: GPT-5 Codex — Date: 2026-04-16
