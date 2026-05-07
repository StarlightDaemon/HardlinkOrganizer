# Work Log

## 2026-05-07 Fujin theme chrome token resolution + SPA migration cleanup

- Confirmed: Fujin agent resolved the blue-tint theme issue (Fujin commit `b645194`). `slate` primary override removed entirely. New `--fujin-chrome-bg/text/border` tokens added — mapped to neutral `dark[7]/dark[0]/dark[6]` in dark mode and `gray[8]/gray[0]/gray[7]` in light mode. Chrome (header, statusbar, nav) is now fully neutral in both modes.
- Confirmed: `--fujin-layout-content-width` token added (`clamp(560px, 78vw, 2400px)`) for fluid responsive layout.
- Confirmed: `ThemeMenu` component added to Fujin — gear icon popover with Light/Dark toggle, wired to `useFujinTheme()`. Integrated into `AppLayout.tsx` status bar right slot.
- Confirmed: Light theme hardened to "Deep" style — `gray[3]` base, white surface, stronger border values.
- Confirmed: `DataTable` generic constraint corrected to `T extends object` (was `Record<string,unknown>`, broke typed row interfaces).
- Confirmed: old Carbon/Jinja2 static files deleted and committed — `webapp/static/app.js`, `carbon-overrides.css`, `style.css`, and `webapp/templates/index.html` removed. SPA migration fully closed.

## 2026-05-06 Mantine theming provider update

- Confirmed: Updated `FujinThemeProvider` usage in `webapp/frontend/src/main.tsx`.
- Confirmed: Removed standalone `MantineProvider` and redundant `styles.css` import as they are now encapsulated within `FujinThemeProvider`.
- Confirmed: Wired the `violet` preset to the theme provider.
- Confirmed: Staged and committed changes.

## 2026-05-06 Fujin/Mantine Theme Slate Integration Review

- Confirmed: Attempted to migrate Mantine's default blue primary color to the Fujin `slate` palette.
- Confirmed: Overrode `primaryColor` and injected custom `slate` scale in `main.tsx`.
- Issue: The user feels the `slate` scale still looks too "blue" and wants a neutral gray or true slate without the blue tint.
- Action: Stopped work and left `fujin_theme_review.md` in `.raiden/local/prompts/` for the Fujin agent to evaluate the correct styling path forward.

## 2026-05-05 React SPA + Fujin UI rebuild session

- Confirmed: `webapp/frontend/` scaffolded with Vite 5 + React 18 + TypeScript 5. `@fujin` alias → `/mnt/e/Fujin/components`; `@tokens` alias → `/mnt/e/Fujin/tokens.json`. Build outputs to `webapp/static/dist/`.
- Confirmed: `webapp/app.py` — Jinja2 template route and imports removed; `StaticFiles(directory=dist, html=True)` mounted at `/` after all API routes.
- Confirmed: `src/api/types.ts` — TypeScript interfaces mirroring all Pydantic models in `webapp/models.py` exactly.
- Confirmed: `src/api/client.ts` — typed fetch wrappers for every API endpoint (health, config/sets, scan, inventory, preview, execute, history, verify, destinations CRUD + validate).
- Confirmed: `src/state/AppState.tsx` — React context with `view` (workflow/destinations), `step`, sourceSet/entry/destSet/preview/result/verifyRun/history/sets state; all setters clear downstream state appropriately; `refreshHistory()` and `refreshSets()` available to components; health check on mount.
- Confirmed: `src/components/AppLayout.tsx` — fixed 48px header with status dot, app name, version, and two nav tabs (Workflow / Destination Registry); flex-row body with main content + 320px aside sidebar.
- Confirmed: 5 workflow step components: SourceStep (scan & select cards), BrowseStep (searchable DataTable + DataColumn, Re-scan), DestStep (dest set grid + subpath + Preview button), PreviewStep (detail grid, warnings collapsible, dry-run Checkbox, Execute), ResultStep (DataCard with count stats, collapsible file lists, Link Another / Start Over).
- Confirmed: `HistorySidebar.tsx` — per-entry verify button triggers `POST /api/verify` → `GET /api/verify/{run_id}` → sets verifyRun + step='verify'; StatusBadge tags for dry-run / linked / failed counts.
- Confirmed: `VerifyPanel.tsx` — summary counts, All/Failures/Verified filter toggles, DataTable with StatusBadge per result, JSON/CSV export via direct `<a download>` links.
- Confirmed: `DestRegistry.tsx` — DataTable with ActionMenu (Edit / Enable-Disable / Delete), inline add/edit FormShell, live path validate-on-blur via `POST /api/destinations/validate` with left-border-accent result display.
- Confirmed: all components use only Fujin CSS vars (`var(--fujin-*)`) and `tokens.*` values; no hardcoded hex/px/font-name; `borderRadius: 0` throughout; no Carbon artifacts.
- Confirmed: toast notifications wired to all async success/error paths via `useToast()`.

## 2026-05-03 Docker-first multi-platform hardening session

- Confirmed: PUID/PGID runtime privilege-drop added to Docker image (`packaging/docker/entrypoint.sh` + Dockerfile); container remaps `hlo` UID/GID at start via `gosu`; defaults 1000:1000.
- Confirmed: Dockerfile `LABEL` description updated to platform-neutral copy; `USER hlo` removed in favour of entrypoint privilege drop.
- Confirmed: `packaging/` restructured to Docker-first multi-platform layout. Canonical Dockerfile and entrypoint moved to `packaging/docker/`. Platform dirs created: `unraid/`, `truenas/`, `omv/`, `portainer/` — each with README and compose/stack file.
- Confirmed: CI workflow (`hardlink-organizer-image.yml`) updated to reference `packaging/docker/Dockerfile`.
- Confirmed: mount-layout warning system extended for MergerFS/OMV. `_classify_mount_layout_path()` now returns `mergerfs_pool` and `omv_disk_mount` kinds. New `mergerfs_pool_path` warning emitted with `_MERGERFS_RECOMMENDATION`. `separate_mount_points` condition generalized to cover `/srv/` mount prefixes. All 5 mount-layout tests pass.
- Confirmed: `README.md` updated: At A Glance target now reflects Docker-first multi-platform; repo map and More Detail entries updated to `.raiden/state/` and `.raiden/local/prompts/`; stale `agent-ledger/` and `agent-prompts/` paths removed.
- Confirmed: `LEGACY_REVIEW.md` updated — all three legacy artifacts (AGENTS.md, agent-ledger, agent-prompts) marked resolved with dates and actions.
- Confirmed: all dead `agent-ledger/` and `agent-prompts/` path references fixed across all prompt files under `.raiden/local/prompts/`.
- Inferred: frontend review completed; two immediate fixes identified (mount warning Unraid-specific copy, hero Target fact); four lower-priority items deferred. See CURRENT_STATE.md open frontend items.
- Inferred: next session should open with the two small frontend fixes, then proceed to LOOP-010 destination registry backend (`prompt-40`).

## 2026-05-03 RAIDEN Instance install and governance migration

- Confirmed: RAIDEN Instance installed from central RAIDEN repo (`/mnt/e/Raiden`) using `raiden_guide.py install` with sample_package (Edict v0.2.0).
- Confirmed: full `init → plan → apply → doctor` cycle passed cleanly; no conflicts or anomalies.
- Confirmed: `AGENTS.md` merged — legacy content preserved and updated to point at `.raiden/state/` control plane.
- Confirmed: `agent-ledger/` content migrated to `.raiden/state/` (CURRENT_STATE, GOALS, OPEN_LOOPS, DECISIONS, WORK_LOG).
- Confirmed: `agent-prompts/` moved to `.raiden/local/prompts/`; README updated to reflect new path.
- Confirmed: `agent-ledger/` retired; original content preserved in git history.
- Inferred: Hardlink Organizer is now a live RAIDEN Instance with LOOP-009 and LOOP-010 intact and ready for continued execution.

## 2026-04-16 local ledger promotion entry

- Confirmed: the user directed that Hardlink Organizer should have its own Agent Ledger and repo tooling.
- Confirmed: created a project-local `agent-ledger/` and updated workspace docs and prompts to treat it as the primary control plane.
- Confirmed: added local `.gitignore` and `.dockerignore` files.
- Inferred: future work could now be planned and handed off directly from this workspace.

## 2026-04-16 workspace extraction planning entry

- Confirmed: created `notes/PROJECT_WORKSPACE_EXTRACTION_PLAN.md`.
- Confirmed: selected `/mnt/e/HardlinkOrganizer` as preferred new top-level workspace path.
- Confirmed: selected `hardlink-organizer` as preferred standalone repository name.
- Confirmed: selected simple copy plus fresh repo initialization as the default migration method.

## 2026-04-16 verification foundation completion entry

- Confirmed: verification runs are persisted and retrievable.
- Confirmed: verification export endpoints exist for JSON and CSV.
- Confirmed: the browser supports history-driven verification from prior real link jobs.
- Confirmed: `0.3.0` verification is functionally complete for the history-driven path.

## 2026-04-16 Unraid preflight hardening entry

- Confirmed: added structured preview warnings for risky Unraid mount layouts.
- Confirmed: updated docs to recommend shared disk-level or pool-level parent mounts.
- Confirmed: added tests covering risky layout warnings and preview serialization.

## 2026-04-15 stabilization and packaging groundwork entry

- Confirmed: fixed the web execution history path and Docker packaging flow.
- Confirmed: added split prompt files under `agent-prompts/` (now `.raiden/local/prompts/`).
- Confirmed: added draft Unraid and Community Apps assets under `packaging/unraid/`.

## 2026-04-14 initial project brief entry

- Confirmed: captured the first product brief for Hardlink Organizer under `README.md`.
- Confirmed: defined the initial CLI-first hardlink workflow and conservative v1 scope.

## Provenance

- Migrated from `agent-ledger/WORK_LOG.md` on 2026-05-03 during RAIDEN Instance install
- Original model: GPT-5 Codex — Date: 2026-04-16
