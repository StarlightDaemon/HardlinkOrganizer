# Prompt 64: v1.0.0 Release Tag (LOOP-015)

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off

## Goal

Cut the official v1.0.0 release. This is the cap loop that closes the 1.0
milestone after all three platform loops are complete. The output is a tagged
GitHub release with a CHANGELOG, updated README badges, and verified install
paths for all three platforms.

## Dependencies — all must be complete before starting this loop

- LOOP-011 (prompt-60): GHCR image public, `v1.0.0-rc.1` tag exists
- LOOP-012 (prompt-61): Hardlink Organizer accepted in Unraid Community Apps
- LOOP-013 (prompt-62): Hardlink Organizer merged into TrueNAS SCALE catalog
- LOOP-014 (prompt-63): OMV deployment validated, community post published

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `.raiden/state/CURRENT_STATE.md`
2. `README.md`
3. `CHANGELOG.md` (if it exists, otherwise create it)
4. `.github/workflows/hardlink-organizer-image.yml`

## Steps

### Step 1 — Write CHANGELOG.md

Create or update `CHANGELOG.md` at the repo root. v1.0.0 entry should cover:

- React SPA frontend (Fujin UI kit) — full workflow in browser
- Docker-first packaging with PUID/PGID runtime privilege drop
- Destination Registry — persistent managed destinations with safety validation
- Verification history — browser-triggered verification with result export
- WorkflowStepper — multi-step UI with preserved state
- Link history sidebar with display names
- Platform support: Unraid (Community Apps), TrueNAS SCALE (native catalog), OMV
- Multi-platform Docker image on GHCR

Use standard Keep a Changelog format.

### Step 2 — Update README.md

Add or update the platform install section with:
- Unraid: CA install badge / link to CA listing
- TrueNAS SCALE: link to SCALE catalog entry
- OMV: link to compose install docs and forum post
- Generic Docker: `docker compose` snippet pointing to GHCR image

Ensure the top-level "At a Glance" table still accurately reflects the current
feature set and supported platforms.

### Step 3 — Final smoke test

On each platform (or confirm from LOOP-012/013/014 notes):
- Unraid: install via Community Apps, verify web UI
- TrueNAS SCALE: install via Apps UI, verify web UI
- OMV: deploy via compose plugin, verify web UI

If any platform install is broken, do not cut the tag — fix and re-verify.

### Step 4 — Cut v1.0.0

```bash
# Confirm all changes are committed
git status

# Tag
git tag -a v1.0.0 -m "Hardlink Organizer v1.0.0"
git push origin v1.0.0
```

Confirm the tag triggers the GHA workflow and produces:
- `ghcr.io/starlightdaemon/hardlink-organizer:v1.0.0`
- `ghcr.io/starlightdaemon/hardlink-organizer:latest` updated

### Step 5 — Create GitHub Release

```bash
gh release create v1.0.0 \
  --title "Hardlink Organizer v1.0.0" \
  --notes-file CHANGELOG_v1.md
```

The release notes should be the v1.0.0 CHANGELOG section. Include links to:
- Unraid Community Apps listing
- TrueNAS SCALE catalog entry
- OMV install guide
- Docker Hub / GHCR image

### Step 6 — Post release announcements

Where applicable:
- Unraid forum support thread: announce v1.0.0 tag
- TrueNAS catalog PR / community thread: note release
- OMV forum post: note release

## Exit criteria

- `CHANGELOG.md` exists with a complete v1.0.0 entry
- `README.md` has install links for all three platforms
- `v1.0.0` tag pushed and GHCR image built
- GitHub Release created with release notes
- All three platform installs verified

## Update CURRENT_STATE when done

Mark LOOP-015 complete. Add GitHub Release URL and GHCR `v1.0.0` image
reference to Evidence. This closes the 1.0 milestone.
