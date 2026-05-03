# Current State

## Summary

- Confirmed: Hardlink Organizer now operates as its own standalone project workspace rooted at `/mnt/e/HardlinkOrganizer` in WSL (`E:\HardlinkOrganizer` on Windows), with a RAIDEN Instance control plane under `.raiden/`.
- Confirmed: the project is at `0.3.0` verification foundation status.
- Confirmed: the hosted web UI and CLI both exist, with verification runs persisted and reviewable.
- Confirmed: the history-driven verification UI slice is closed locally, including browser-triggered verification from prior real link jobs, stored-result review, JSON or CSV exports, and lightweight result filtering.
- Confirmed: Docker image is now NAS-hardened with PUID/PGID runtime privilege-drop via `gosu` entrypoint; defaults to 1000:1000.
- Confirmed: packaging is now Docker-first and multi-platform. `packaging/docker/` holds the canonical Dockerfile and entrypoint. Per-platform directories exist for Unraid, TrueNAS, OMV, and Portainer.
- Confirmed: mount-layout warnings now cover MergerFS/OMV (`mergerfs_pool_path` warning code) alongside the existing Unraid patterns. The `separate_mount_points` condition is platform-neutral. All 5 mount-layout tests pass.
- Confirmed: `README.md` framing updated to Docker-first multi-platform; all stale `agent-ledger/` and `agent-prompts/` path references replaced with `.raiden/state/` and `.raiden/local/prompts/`.
- Confirmed: the LOOP-010 destination registry and validation backend is complete. The `destinations` table, all five API routes, and full test coverage are merged. The destination-management UI and naming work remain as the next slice after this.
- Confirmed: RAIDEN Instance installed 2026-05-03; governance migration complete; LEGACY_REVIEW.md shows all three legacy artifacts resolved.
- Confirmed: planning can generally assume access to these model families in this workspace context: `Gemini 3.1 Pro (high)`, `Gemini 3.1 Pro (low)`, `Gemini 3 Flash`, `Claude Sonnet 4.6 (thinking)`, `Claude Opus 4.6 (thinking)`, `GPT-OSS-120b`, `GPT-5.4`, `GPT-5.2-Codex`, `GPT-5.1-Codex-Max`, `GPT-5.4-Mini`, `GPT-5.3-Codex`, `GPT-5.2`, and `GPT-5.1-Codex-Mini`.

## Evidence

- Confirmed: `packaging/docker/Dockerfile` includes gosu install, PUID/PGID ENV defaults, and `/entrypoint.sh` as the container entrypoint.
- Confirmed: `packaging/docker/entrypoint.sh` remaps hlo UID/GID at container start and drops privilege via `exec gosu hlo`.
- Confirmed: `packaging/` contains `docker/`, `unraid/`, `truenas/`, `omv/`, and `portainer/` subdirectories, each with README and compose/stack files.
- Confirmed: `hardlink_organizer.py` `_classify_mount_layout_path()` recognizes `mergerfs_pool` and `omv_disk_mount` path kinds in addition to Unraid patterns.
- Confirmed: `hardlink_organizer.py` `assess_mount_layout()` emits `mergerfs_pool_path` warning and uses `_MERGERFS_RECOMMENDATION` for OMV paths.
- Confirmed: `README.md` At A Glance table shows `Docker — Unraid, TrueNAS, OMV, and generic Linux` as primary target.
- Confirmed: `.github/workflows/hardlink-organizer-image.yml` references `packaging/docker/Dockerfile` (updated from `packaging/unraid/docker/Dockerfile`).
- Confirmed: `notes/HARDLINK_ORGANIZER_NEXT_STEPS.md` and `notes/HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md` identify destination management with safe path validation as the next major milestone after verification.
- Confirmed: `.raiden/local/prompts/prompt-40-destination-registry-validation-backend.md` defined the now-complete LOOP-010 backend slice.
- Confirmed: `engine/db.py` has a `destinations` table (id, label, path UNIQUE, tag, enabled, notes, created_at, updated_at) with full CRUD methods.
- Confirmed: `webapp/app.py` routes: `GET /api/destinations`, `POST /api/destinations`, `POST /api/destinations/validate`, `PATCH /api/destinations/{id}`, `DELETE /api/destinations/{id}`.
- Confirmed: validation checks existence, directory type, unsafe-root blocklist (`_UNSAFE_DEST_ROOTS`), writability, Unraid `/mnt/user` (`unraid_user_share`), and MergerFS pool (`mergerfs_pool_path`) — returns structured `DestinationValidateResponse`.
- Confirmed: two frontend copy fixes applied: mount warning is now platform-neutral; hero Target now says "NAS / homelab workflows".
- Confirmed: full Carbon G100 dark theme rebuild committed (f97c762). CDN injection via `@carbon/styles@1`; all values token-only via `var(--cds-*)`. `carbon-overrides.css` added (787 lines); `style.css` emptied. `index.html` and `app.js` fully rebuilt with Carbon component markup.
- Confirmed: test suite — 176 tests pass (47 DB + 129 webapp, 2 skipped on non-Linux) — 0 regressions post-Carbon rebuild.

## Open frontend items (deferred to a later pass)
3. Inline `onclick` JS string injection in history/verify buttons — replace with `data-*` + delegated listeners before public release.
4. History sidebar shows `real_name` instead of `display_name`.
5. Step bar blanks out during verify step.
6. Inline styles in `renderVerifyStep` belong in CSS.

## Constraints

- Confirmed: model availability and token ceilings may vary by session even when the planning baseline model pool remains broader.
- Confirmed: each new loop should re-check current model or token status with the user when model choice or handoff strategy could materially affect the work.
- Confirmed: Community Apps publication still depends on external steps including GHCR publication, real host validation, support-thread publication, and template submission.
- Confirmed: full HTTP-level integration coverage remains a separate follow-up because the current local FastAPI dependency stack hangs under `TestClient`.

## Provenance

- Migrated from `agent-ledger/CURRENT_STATE.md` on 2026-05-03 during RAIDEN Instance install
- Original model: GPT-5 Codex — Date: 2026-04-16
