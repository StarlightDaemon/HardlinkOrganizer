# Open Loops

Work must be executed one loop at a time.

Bounded prompt slices may be used to advance one loop safely without widening
into adjacent work.

## LOOP-009: drive Hardlink Organizer through Community Apps submission

- Status: closed — superseded (see closure note)
- Scope: take Hardlink Organizer from local beta and draft Unraid packaging assets through real-host validation, GHCR publication, CA template hardening, dedicated template repository setup, support-thread publication, and formal Community Apps submission
- Readiness: partial
- Evidence plan: use `packaging/unraid/README.md`, `packaging/unraid/CA_PUBLISHING_GUIDE.md`, `packaging/unraid/VALIDATION_CHECKLIST.md`, and the current packaging assets under `packaging/unraid/`
- Validation plan: verify each external dependency is completed in order, the published image and CA template agree, support and project URLs are real, and submission artifacts are captured back into the project ledger
- Closure condition: Hardlink Organizer is submitted to Community Apps and the project ledger records the submission state plus any outstanding review follow-up
- **Closure note (2026-07-08):** On 2026-05-07 (commit `94e4008`, "chore: close LOOP-011 — repo public, GHCR image live, v1.0.0-rc.1 tagged") this single 7-step loop was split by publication stage into five sequenced loops, defined in `.raiden/local/prompts/prompt-60-ghcr-publication.md` through `prompt-64-v1-release-tag.md`. `prompt-61-unraid-community-apps.md` states directly: "This loop supersedes LOOP-009 ... and executes the same 7-step path now that the Docker image is public on GHCR." That restructuring is confirmed by the prompt files' own headers (LOOP-011 through LOOP-015). However, this file was never updated to reflect it — LOOP-009 sat here marked "open" for two months while `CURRENT_STATE.md` separately described it as "retired and superseded by LOOP-011–015," a set that did not exist as tracked loop entries anywhere. That contradiction is the fleet-probe finding this note resolves. The five successor loops are added below with their actual status as of 2026-07-08; **the underlying Community Apps submission itself has still not happened** — only LOOP-011 (GHCR publication) is actually closed.

## LOOP-011: GHCR publication

- Status: closed 2026-05-07 (commit `94e4008`)
- Scope: publish the Docker image publicly on GHCR so the downstream platform loops (Unraid CA, TrueNAS catalog, OMV) have a real pullable artifact
- Evidence: GHA runs `25513495017` (main push) and `25513628167` (tag `v1.0.0-rc.1`), both success; image published at `ghcr.io/starlightdaemon/hardlink-organizer:latest` and `:v1.0.0-rc.1`
- Outstanding: GHCR package visibility (Public) was still pending manual confirmation per `CURRENT_STATE.md`; has not been re-verified as part of this pass
- Closure condition: met — image confirmed public and pullable per commit message; manual visibility re-check recommended before relying on it

## LOOP-012: Unraid Community Apps submission

- Status: open
- Gate: hardware
- Scope: supersedes LOOP-009's Unraid-specific path — carry the validated public Docker image through real Unraid host validation, CA template hardening, dedicated template repository setup, support-thread publication, and formal Community Apps submission
- Readiness: blocked — requires a real Unraid host; none has been available to this workspace
- Evidence plan: `packaging/unraid/README.md`, `CA_PUBLISHING_GUIDE.md`, `VALIDATION_CHECKLIST.md`, `SUPPORT_THREAD_DRAFT.md`, `.raiden/local/prompts/prompt-61-unraid-community-apps.md`
- Dependency: LOOP-011 (closed)
- Closure condition: Hardlink Organizer accepted and listed in Unraid Community Apps

## LOOP-013: TrueNAS SCALE native catalog

- Status: open (partial — steps 1+2 complete)
- Gate: operator
- Scope: submit Hardlink Organizer to the `truenas/apps` community catalog for native install via the SCALE Apps UI
- Evidence: `packaging/truenas/catalog/` contains `app.yaml`, `ix_values.yaml`, `questions.yaml`, a docker-compose template, and test values (commit `0f10d62`, "feat: add TrueNAS SCALE catalog entry (LOOP-013 step 1+2)")
- Readiness: PR to `truenas/apps` not yet opened/merged as of this pass — no evidence in git history of a merge; blocked on GHCR visibility confirmation and real-host validation per `CURRENT_STATE.md`
- Closure condition: catalog entry merged into `truenas/apps` and installable from the SCALE Apps UI

## LOOP-014: OMV community release

- Status: open
- Gate: operator
- Scope: validate on OpenMediaVault and publish community-facing docs/compose files plus targeted forum posts (OMV has no central app marketplace)
- Evidence: `packaging/omv/` contains a `README.md` and `docker-compose.yml`; no evidence found of forum/community posts having been made
- Readiness: packaging scaffolding exists, host validation and community publication not started
- Dependency: LOOP-011 (closed)
- Closure condition: validated OMV compose stack published with community-post presence

## LOOP-015: v1.0.0 release tag

- Status: closed 2026-07-08
- Scope: per `.raiden/local/prompts/prompt-64-v1-release-tag.md`, cut the official v1.0.0 GitHub release (CHANGELOG, README badges, verified install paths across all three platforms) once LOOP-012/013/014 are all complete
- Evidence: git tags `v1.0.0` through `v1.0.6` exist (`v1.0.0` cut 2026-06-02, message "Stable v1.0.0 release... Three-pass pre-release audit... Published to Docker Hub and GHCR") and the project has since patch-released through `v1.0.6`
- **Closure note (2026-07-08):** Release tags `v1.0.0`–`v1.0.6` have shipped on ordinary release-engineering grounds (test/audit pass). The original platform-gate exit criteria (Unraid CA + TrueNAS + OMV complete first) have been re-scoped out of this loop per operator decision — this work is independently tracked by LOOP-012 (Unraid CA) and LOOP-014 (OMV), both of which remain open. LOOP-015 closes here as "release tag shipped"; platform marketplace completion is tracked separately.

## LOOP-010: destination-side naming cleanup

- Status: Closed (2026-07-09) — destination naming preview/apply/history shipped end-to-end (backend routes, DestRegistry "Clean names" panel, docs); preview-first, source-safe, audit-logged, dry-run by default, with Unraid/MergerFS rename constraints explained. Hardened same day per adversarial probe findings (fail-closed source safety, atomic no-clobber, symlink is_dir alignment). See `WORK_LOG.md` § 2026-07-09 (both entries).
- Gate: none
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
- Result: all /mnt/e/ references eliminated; commit 0d1e973 pushed to main (see `WORK_LOG.md` § 2026-06-07 for the full dated record, including the Edict-version confirmation made at that time)
