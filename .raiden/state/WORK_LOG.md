# Work Log

## 2026-07-09 — Edict v2.0.0 + state normalization

- Confirmed: RAIDEN Instance updated from Edict v1.0.1 to Edict v2.0.0 via `raiden_updater.cli` plan → apply → re-plan cycle (all three runs clean; re-plan reported "Already up to date"). Managed writ files updated: `README.md`, `OPERATING_RULES.md`, `WORKSPACE_AUDIT_PROTOCOL.md`, `FORK_REVIEW_PROTOCOL.md`, `AGENTS.md`; `ROUTING_POLICY.md` added; `MODEL_TIERS.md` removed (`managed_file_removal` warning — expected, the tier concept is superseded by the local `ROUTING.md` overlay). Hook `commit-msg` unchanged. `.raiden/instance/metadata.json` stamped with `"state_schema_version": 2`.
- Confirmed: routing overlay migrated. `.raiden/local/MODEL_MAP.md` (gitignored, untracked — not under git's management) removed from disk; `.raiden/local/ROUTING.md` created as the new local routing-ladder surface (R1–R4 rungs plus an offload pool). DEC-006's pinned model pool in `DECISIONS.md` is left untouched as decision history per instruction; `ROUTING.md` is now the operative routing surface going forward.
- Relocated (Edict-version prose, N1 fact-home violation — doctor `version_prose` lint): `CURRENT_STATE.md` carried "RAIDEN Instance is on Edict v1.0.0 (`.raiden/instance/metadata.json`, updated 2026-06-12, commit 3e9e4b8 'chore: update RAIDEN Instance to Edict v1.0.0'). The prior 'Edict v0.6.1 confirmed clean' line above described the 2026-06-07 state and was left stale for a month after the v1.0.0 update; corrected 2026-07-08 per fleet probe finding." The Edict v1.0.0 current-version claim is **deleted outright** — it was already stale (now v2.0.0) and the installed version's only authoritative home is `metadata.json`, never state prose. The historical note about the v0.6.1→v1.0.0 drift incident (a real governance history event) is preserved: on 2026-06-07 a migration audit recorded "Edict v0.6.1 confirmed clean"; the Instance was actually updated to v1.0.0 on 2026-06-12 (commit `3e9e4b8`) but `CURRENT_STATE.md` was not corrected until 2026-07-08 per a fleet-probe finding — a month of stale version prose in state. `OPEN_LOOPS.md`'s "Migration audit — CLOSED 2026-06-07" entry also carried "Result: Edict v0.6.1 confirmed clean" prose — removed from that file since the identical fact is already the sanctioned dated record at `WORK_LOG.md` § 2026-06-07 below (line 5), which is exempt from the `version_prose` lint by design (dated work-log entries are the Fact-Home Rule's sanctioned home for version history).
- Relocated (loop-status restatement, N1 fact-home violation): `CURRENT_STATE.md`'s Constraints section restated LOOP-009/011/012/013/014/015 open/closed status in prose, duplicating `OPEN_LOOPS.md`'s authoritative entries. All converted to bare `LOOP-xxx` citations. The LOOP-009 paragraph is relocated here verbatim before deletion: "LOOP-009 (Community Apps) retired 2026-05-07 (commit 94e4008) and restructured into five sequenced loops — LOOP-011 (GHCR publication, closed), LOOP-012 (Unraid Community Apps, open — blocked on real Unraid host), LOOP-013 (TrueNAS SCALE catalog, open/partial — steps 1+2 done, PR not yet merged), LOOP-014 (OMV community release, open — not started), LOOP-015 (v1.0.0 release tag, closed 2026-07-08 — tags `v1.0.0`–`v1.0.6` shipped; platform-gate exit criteria re-scoped to LOOP-012/LOOP-014). See `.raiden/local/prompts/prompt-60` through `prompt-64` for scope, and `.raiden/state/OPEN_LOOPS.md` for the authoritative tracked status of each (added 2026-07-08 — these loops existed only in prompt files for two months and were never entered into OPEN_LOOPS.md, which is why LOOP-009 still showed 'open' there until this fix)." **Discrepancy noted, not resolved by this pass:** as originally written this claim asserted LOOP-011–LOOP-015 "did not exist as tracked loop entries anywhere" in `OPEN_LOOPS.md`. That premise is itself stale by the time of this relocation — `OPEN_LOOPS.md` already contains tracked entries for LOOP-011 through LOOP-015 (added in commit `003dd0d`, "chore: relocate session artifacts out of managed writ/, reconcile state with Edict v1.0.0", 2026-07-08) with LOOP-009 marked "closed — superseded (see closure note)". Whether the full history here is internally consistent across every prior session is not re-verified in this pass; the claim is recorded verbatim as history, not asserted as a currently-open discrepancy. No loop IDs were invented. LOOP-009's own `OPEN_LOOPS.md` entry is left untouched by this pass.
- Relocated (loop-status restatement): the LOOP-011 (GHCR publication) narrative that duplicated `OPEN_LOOPS.md` LOOP-011 is folded into the `2026-05-07 GHCR publication (LOOP-011)` entry below, preserving detail (GHA run IDs, Node.js 20 deprecation note, outstanding visibility check) not already captured elsewhere. LOOP-010 and LOOP-013 narratives were deleted outright from `CURRENT_STATE.md` as pure duplicates of their `OPEN_LOOPS.md` entries and this file's own `## Evidence` section — cross-checked before deletion, no unique content lost.
- Relocated (volatile counts, N1 fact-home violation — the 176/180/132 test-count drift class): `CURRENT_STATE.md` carried three stale test-suite counts, none of which belong in current-state prose. "176 tests pass (47 DB + 129 webapp, 8 skipped on non-Linux) — 0 regressions post-Carbon rebuild" folded into the existing `WORK_LOG.md` § 2026-05-07 "Fujin theme chrome token resolution + SPA migration cleanup" entry below (same event — the Carbon/Jinja2 removal that entry already records). "132 tests pass; tsc and build clean" trailing clause dropped outright from the frontend-polish-items bullet — the identical count is already the dated record at `WORK_LOG.md` § 2026-05-07 "Frontend polish — display_name in history + stepper state preservation" entry (line 22). "Test suite fully green: 180/180 (was 179 pass + 1 pre-existing failure)" relocated into the new `2026-05-08 Backend security and correctness fixes` entry below along with the rest of that bullet's unique content (commits `a854bcb`, `e577e42`).
- Removed: hand-written `**Last Updated:** 2026-07-08` footer from `CURRENT_STATE.md` per the Fact-Home Rule — freshness is derived from git history, not a hand-maintained footer.
- Confirmed: `CURRENT_STATE.md`'s WSL→macOS migration bullet trimmed to its still-true present-tense fact (workspace root location) with a pointer to `WORK_LOG.md` § 2026-06-07 — the full P1–P11 event narrative was already the dated record there and is not repeated in current-state prose.
- Doctor before this pass: `worst=WARN` — `version_prose` (`CURRENT_STATE.md`, `OPEN_LOOPS.md`); all other checks OK. Doctor after: see acceptance run recorded by the operator/session that closes this pass.

## 2026-05-08 Backend security and correctness fixes

- Confirmed: three issues from Opus review resolved. (1) path traversal via `dest_subpath` blocked in `LinkPlan.is_valid()` — commit `a854bcb`. (2) `hardlink_file()` now warns on collision instead of silently skipping — commit `e577e42`. (3) `get_link_status()` chunked to avoid the SQLite 999-variable limit — commit `e577e42`.
- Confirmed: test suite fully green — 180/180 (was 179 pass + 1 pre-existing failure).
- Note (relocated 2026-07-09 from `CURRENT_STATE.md` during Edict v2.0.0 state normalization): the original bullet ended "Commits pending push"; both `a854bcb` and `e577e42` are confirmed present in `main`'s history as of the relocation date, so that caveat is stale and dropped.

## 2026-06-07 WSL→macOS migration remediation

- Confirmed: migration audit completed. Edict v0.6.1 confirmed clean. All findings executed in order P1–P11.
- Confirmed: P1–P9 — all /mnt/e/ path references replaced with /Users/dante/Citadel/ equivalents across AGENTS.md root, .raiden/AGENTS.md, .raiden/local/prompts/README.md, CURRENT_STATE.md, DECISIONS.md, WORK_LOG.md, DECISIONS.md DEC-008, .raiden/local/legacy/AGENTS.legacy.md, and 47 files via bulk sed across .raiden/local/prompts/, packaging/unraid/, docs/agent-prompts/.
- Confirmed: P6 — .claude/settings.local.json deleted (was untracked; contained 13 dead git -C /mnt/e/HardlinkOrganizer entries and 2 /mnt/c/Users/agent007/ python.exe paths from a different user account).
- Confirmed: P10 — webapp/frontend/node_modules rebuilt clean via npm ci on ARM64 macOS. 95 packages added, 0 vulnerabilities, no native addon warnings.
- Confirmed: P11 — macOS /proc/ degradation comment added above mountinfo read in hardlink_organizer.py:544.
- Confirmed: global grep across all .md/.py/.json/.toml/.sh/.ts/.js files finds zero /mnt/e/ references.
- Confirmed: commit 0d1e973 pushed to main. commit-msg hook not yet executable (non-blocking advisory).

## 2026-05-07 Frontend polish — display_name in history + stepper state preservation

- Confirmed: `display_name` added to `link_history` table via `_SCHEMA` DDL and `_init_schema()` migration guard (`ALTER TABLE ... ADD COLUMN`, catches `OperationalError` for existing DBs).
- Confirmed: `record_link()` in `engine/db.py` accepts and stores `display_name: str | None = None`.
- Confirmed: `webapp/app.py` — `record_link` call passes `display_name=entry.get("display_name")`; `HistoryEntry` construction in `get_history` passes `display_name=r.get("display_name")`.
- Confirmed: `webapp/models.py` `HistoryEntry` and `webapp/frontend/src/api/types.ts` `HistoryEntry` both include `display_name: str | None = None` / `string | null`.
- Confirmed: `HistorySidebar.tsx` renders `entry.display_name ?? entry.real_name`.
- Confirmed: `WorkflowStepper` kept mounted during verify step via `display: isVerify ? 'none' : 'block'` in `App.tsx` — stepper internal position preserved; back from VerifyPanel restores correct step.
- Confirmed: Items 1 (onclick injection) and 4 (renderVerifyStep styles) confirmed dead — Carbon/vanilla JS patterns eliminated by SPA migration, no action needed.
- Confirmed: 132 pytest tests pass (1 pre-existing unrelated failure); tsc and npm run build both clean.

## 2026-05-07 DestRegistry UI fix pass

- Confirmed: `webapp/frontend/src/components/DestRegistry.tsx` — four bugs fixed by a dedicated thinking agent.
- Confirmed: FormPanel stale state on edit switch resolved — `key={editTarget?.id ?? 'add'}` forces remount on target change.
- Confirmed: Double container border removed — outer form wrapper now carries only `padding`; `FormShell` provides the visual shell.
- Confirmed: Delete confirmation added — `deletePending: number | null` state gates the ActionMenu delete action; requires a second explicit click on "Confirm delete".
- Confirmed: Path validation gate on submit — `validatePath()` extracted as shared async function; `handleSubmit` fires validation and blocks on invalid result when user submits without blurring the path field.
- Confirmed: `tsc --noEmit` and `npm run build` both clean post-fix (768 modules, 0 errors).

## 2026-05-07 Fujin theme chrome token resolution + SPA migration cleanup

- Confirmed: Fujin agent resolved the blue-tint theme issue (Fujin commit `b645194`). `slate` primary override removed entirely. New `--fujin-chrome-bg/text/border` tokens added — mapped to neutral `dark[7]/dark[0]/dark[6]` in dark mode and `gray[8]/gray[0]/gray[7]` in light mode. Chrome (header, statusbar, nav) is now fully neutral in both modes.
- Confirmed: `--fujin-layout-content-width` token added (`clamp(560px, 78vw, 2400px)`) for fluid responsive layout.
- Confirmed: `ThemeMenu` component added to Fujin — gear icon popover with Light/Dark toggle, wired to `useFujinTheme()`. Integrated into `AppLayout.tsx` status bar right slot.
- Confirmed: Light theme hardened to "Deep" style — `gray[3]` base, white surface, stronger border values.
- Confirmed: `DataTable` generic constraint corrected to `T extends object` (was `Record<string,unknown>`, broke typed row interfaces).
- Confirmed: old Carbon/Jinja2 static files deleted and committed — `webapp/static/app.js`, `carbon-overrides.css`, `style.css`, and `webapp/templates/index.html` removed. SPA migration fully closed.
- Confirmed (relocated 2026-07-09 from `CURRENT_STATE.md` during Edict v2.0.0 state normalization): test suite — 176 tests pass (47 DB + 129 webapp, 8 skipped on non-Linux) — 0 regressions post-Carbon rebuild.

## 2026-05-07 GHCR publication (LOOP-011)

- Confirmed (relocated 2026-07-09 from `CURRENT_STATE.md` during Edict v2.0.0 state normalization — content unchanged, two near-duplicate `CURRENT_STATE.md` bullets merged here): repo made public at https://github.com/StarlightDaemon/HardlinkOrganizer (tip commit `0f10d62` at the time). GHA image workflow ran successfully on both the `main` push and the tag push. RC tag `v1.0.0-rc.1` published and workflow confirmed success.
- Confirmed: GHA runs `25513495017` (main push) and `25513628167` (tag `v1.0.0-rc.1`) both completed success. GHCR image published at `ghcr.io/starlightdaemon/hardlink-organizer:latest` and `:v1.0.0-rc.1`.
- Confirmed: Node.js 20 deprecation warning present in the workflow — non-blocking (deadline Sept 2026).
- Outstanding at time of writing: GHCR package visibility (Public) still pending manual confirmation — check https://github.com/StarlightDaemon?tab=packages and set `hardlink-organizer` to Public if needed. See `OPEN_LOOPS.md` LOOP-011 for current tracked status.

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

- Confirmed: `webapp/frontend/` scaffolded with Vite 5 + React 18 + TypeScript 5. `@fujin` alias → `/Users/dante/Citadel/Fujin/components`; `@tokens` alias → `/Users/dante/Citadel/Fujin/tokens.json`. Build outputs to `webapp/static/dist/`.
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

- Confirmed: RAIDEN Instance installed from central RAIDEN repo (`/Users/dante/Citadel/Raiden`) using `raiden_guide.py install` with sample_package (Edict v0.2.0).
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
- Confirmed: selected `/Users/dante/Citadel/HardlinkOrganizer` as preferred new top-level workspace path.
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
