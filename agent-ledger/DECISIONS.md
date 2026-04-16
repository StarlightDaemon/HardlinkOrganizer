# Decisions

## DEC-001: use a project-local Agent Ledger as the control plane

- Date: 2026-04-16
- Status: active
- Confirmed: the user explicitly directed that Hardlink Organizer should have its own Agent Ledger because it has grown into a full project.
- Inferred: project-local continuity and planning now matter more than routing every project decision back through the parent repository ledger.
- Impact: future Hardlink Organizer planning and execution should start from `./agent-ledger/` inside this workspace.

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
- Inferred: this remains the correct product shape for less-technical Unraid operators while keeping a maintenance path for direct execution and recovery.
- Impact: new user-facing work should land in the web app first unless the task is clearly backend-only or CLI maintenance.

## DEC-004: use a staged Community Apps path instead of a one-shot submission

- Date: 2026-04-16
- Status: active
- Confirmed: Community Apps publication still depends on external prerequisites including real-host validation, public image publication, template hardening, and support-thread publication.
- Inferred: the lowest-risk publication path is still a staged gated program rather than direct submission.
- Impact: `LOOP-009` should continue to advance one stage at a time through the local roadmap and packaging docs.

## DEC-005: prefer shared disk-level or pool-level parent mounts for real Unraid execution

- Date: 2026-04-16
- Status: active
- Confirmed: project docs record that `/mnt/user` paths and separate container bind mounts can preview as safe while still failing real hardlink execution with `EXDEV`.
- Inferred: shared disk-level or pool-level parent mounts are the reliable default for actual hardlink execution.
- Impact: preview, validation, docs, and later destination-management features should keep surfacing this Unraid-specific constraint.

## DEC-006: use the user-provided model pool as the default planning baseline

- Date: 2026-04-16
- Status: active
- Confirmed: the user explicitly asked that the generally available models be retained in the ledger for future work planning.
- Confirmed: the stated baseline includes `Gemini 3.1 Pro (high)`, `Gemini 3.1 Pro (low)`, `Gemini 3 Flash`, `Claude Sonnet 4.6 (thinking)`, `Claude Opus 4.6 (thinking)`, `GPT-OSS-120b`, `GPT-5.4`, `GPT-5.2-Codex`, `GPT-5.1-Codex-Max`, `GPT-5.4-Mini`, `GPT-5.3-Codex`, `GPT-5.2`, and `GPT-5.1-Codex-Mini`.
- Inferred: prompt planning should assume this broader model pool exists unless the user reports a change, while still adapting to session-specific token pressure or temporary model limits.
- Impact: model recommendations should favor the cheapest or narrowest adequate model from this pool, and each new loop should re-check current model or token status with the user when that status could affect scope or handoff choice.

## DEC-007: keep minimal repo-tooling files local so the workspace can stand on its own

- Date: 2026-04-16
- Status: active
- Confirmed: the user explicitly directed that Hardlink Organizer should now have its own repo tooling because it has stepped up to a full project.
- Inferred: the project should be extractable or mirrored into its own repository without first depending on root-level ignore or prompt infrastructure from the parent repo.
- Impact: local prompt roots, ignore files, and ledger references should point at this workspace rather than assuming the parent repository root.

## DEC-008: extract Hardlink Organizer into its own top-level workspace by simple copy first

- Date: 2026-04-16
- Status: active
- Confirmed: after the backup checkpoint, the user approved concrete planning for the actual workspace extraction target.
- Confirmed: the selected target path is `/mnt/e/HardlinkOrganizer`.
- Confirmed: the selected standalone repository name is `hardlink-organizer`.
- Confirmed: the selected default migration method is simple copy into the new workspace followed by a fresh Git repository there.
- Inferred: this is safer and easier to validate than a subtree or filtered-history split while the project is still stabilizing its local control plane.
- Impact: the first extraction execution pass should optimize for a clean standalone root and correct URLs rather than preserving nested commit ancestry.

## DEC-009: leave a pointer in the parent repository after extraction

- Date: 2026-04-16
- Status: active
- Confirmed: the selected parent-repo aftermath is to keep a short pointer or stub note instead of silently removing the old path.
- Inferred: this reduces confusion for future agents or humans who still look for Hardlink Organizer under `StarlightDaemonDev`.
- Impact: the post-move cleanup pass should include a parent-repo stub update in addition to the standalone repo bring-up.

## Provenance

- Model: GPT-5 Codex
- Reasoning level: structured workspace promotion
- Date: 2026-04-16
- Inputs: current project docs, roadmap notes, repo-level decisions, and user direction to promote Hardlink Organizer into a full project workspace
- Confidence: high
