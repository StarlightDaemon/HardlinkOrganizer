# Current State

## Summary

- Confirmed: React SPA frontend (Fujin UI kit) fully scaffolded and implemented at `webapp/frontend/`. `FujinThemeProvider` now encapsulates `MantineProvider` and supports Open Color presets (currently using `violet`). All Carbon CSS, `--cds-*` vars, IBM Plex, and Jinja2 server-side injection removed. FastAPI now serves `webapp/static/dist/` via `StaticFiles(html=True)`. Build: `cd webapp/frontend && npm install && npm run build`. Dev: `npm run dev` (proxies `/api` → port 8000).
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
- Confirmed: Fujin design system compliance audit complete. All components use only Fujin CSS vars (`var(--fujin-*)`) and `tokens.json` values; no hardcoded hex/px/font-name; `borderRadius: 0` throughout; all Carbon artifacts removed. Integration with Mantine's Open Color system via `FujinThemeProvider` presets is live.
- Confirmed: test suite — 176 tests pass (47 DB + 129 webapp, 2 skipped on non-Linux) — 0 regressions post-Carbon rebuild.

- Confirmed: Fujin theme color issue resolved. `slate` primary override removed. Chrome (header/statusbar/nav) now uses `--fujin-chrome-bg/text/border` tokens mapped to fully neutral `dark[7]/dark[0]/dark[6]` — no blue tint. Accent (`violet`) is intentionally scoped to interactive elements only. New tokens: `--fujin-chrome-*`, `--fujin-layout-content-width` (`clamp(560px, 78vw, 2400px)`). `ThemeMenu` component (Light/Dark toggle) added to Fujin and wired into `AppLayout.tsx` status bar. Light theme hardened to "Deep" style. `DataTable` generic constraint fixed (`T extends object`). Fujin commit `b645194`.
- Confirmed: old Carbon/Jinja2 static files (`webapp/static/app.js`, `carbon-overrides.css`, `style.css`, `webapp/templates/index.html`) deleted and committed. SPA migration fully closed.

- Confirmed: DestRegistry UI end-to-end complete. Four targeted fixes applied to `webapp/frontend/src/components/DestRegistry.tsx`: (1) FormPanel stale state on edit-switch fixed via `key={editTarget?.id ?? 'add'}`; (2) double container border removed from form wrapper — only padding remains, `FormShell` owns the visual shell; (3) delete confirmation added via `deletePending` state — Delete ActionMenu item stages a confirm/cancel pair before executing; (4) path validation gated on submit — extracted `validatePath()` shared async function, `handleSubmit` triggers validation and blocks if result is invalid when user never blurred the path field. `tsc --noEmit` and `npm run build` both clean after all changes.

- Confirmed: all four deferred frontend polish items resolved. Items 1 (inline onclick injection) and 4 (renderVerifyStep inline styles) were already eliminated by the React SPA migration — both were Carbon/vanilla JS patterns with no equivalent in the new codebase. Item 2 (`real_name` vs `display_name` in sidebar): `display_name` column added to `link_history` table via `_SCHEMA` + `_init_schema()` migration guard; `record_link()` updated to accept and store it; `get_history` returns it; `HistoryEntry` Pydantic model and TypeScript interface updated; `HistorySidebar` now renders `display_name ?? real_name`. Item 3 (step bar blanks out): `WorkflowStepper` now kept mounted during verify via `display: isVerify ? 'none' : 'block'` wrapper — stepper internal step state is preserved, so back from VerifyPanel restores the correct workflow position. 132 tests pass; tsc and build clean.

## Constraints

- Confirmed: model availability and token ceilings may vary by session even when the planning baseline model pool remains broader.
- Confirmed: each new loop should re-check current model or token status with the user when model choice or handoff strategy could materially affect the work.
- Confirmed: LOOP-009 (Community Apps) retired and superseded by the LOOP-011–015 multi-platform 1.0 release structure. See `.raiden/local/prompts/prompt-60` through `prompt-64`.
- Confirmed: LOOP-011 complete 2026-05-07. Repo public at https://github.com/StarlightDaemon/HardlinkOrganizer (tip commit 0f10d62). GHA image workflow ran successfully on both main push and tag push. RC tag v1.0.0-rc.1 published and workflow confirmed success. GHCR image visibility must be confirmed manually — check https://github.com/StarlightDaemon?tab=packages and set hardlink-organizer to Public if needed.
- Confirmed: LOOP-013 Steps 1+2 complete (commit 0f10d62). TrueNAS SCALE catalog entry at `packaging/truenas/catalog/` — full Jinja2 template structure (app.yaml, ix_values.yaml, questions.yaml, templates/docker-compose.yaml, test_values). PR to truenas/apps pending real-host validation.
- Confirmed: 1.0 platform targets are Unraid (Community Apps), TrueNAS SCALE (native catalog via truenas/apps PR), and OMV (compose plugin + community posts). Next open loop is LOOP-012 (Unraid CA) — requires real Unraid host. LOOP-013 PR can proceed once GHCR visibility confirmed and host validation done.
- Confirmed: full HTTP-level integration coverage remains a separate follow-up because the current local FastAPI dependency stack hangs under `TestClient`.

- Confirmed: LOOP-011 complete 2026-05-07. GHA run 25513495017 (main push) and 25513628167 (v1.0.0-rc.1 tag) both completed success. GHCR image published at ghcr.io/starlightdaemon/hardlink-organizer:latest and ghcr.io/starlightdaemon/hardlink-organizer:v1.0.0-rc.1. Visibility pending manual confirmation — Node.js 20 deprecation warning in workflow is non-blocking (deadline Sept 2026).

## Provenance

- Migrated from `agent-ledger/CURRENT_STATE.md` on 2026-05-03 during RAIDEN Instance install
- Original model: GPT-5 Codex — Date: 2026-04-16
