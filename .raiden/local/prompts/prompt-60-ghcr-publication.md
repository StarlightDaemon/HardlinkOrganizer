# Prompt 60: GHCR Publication (LOOP-011)

## Status: COMPLETE — 2026-05-07

- Repo pushed to GitHub: https://github.com/StarlightDaemon/HardlinkOrganizer (tip 0f10d62)
- GHA runs: 25513495017 (main) + 25513628167 (tag) — both success
- GHCR image: ghcr.io/starlightdaemon/hardlink-organizer:latest + :v1.0.0-rc.1
- Pending: confirm package visibility is Public at https://github.com/StarlightDaemon?tab=packages

Recommended model:
- Claude Sonnet 4.6
- No planning needed — this is pure infrastructure verification

Recommended mode:
- planning off

## Goal

Get the Hardlink Organizer Docker image publicly available on GHCR so all
downstream platform loops (Unraid CA, TrueNAS catalog, OMV) have a real pullable
image to reference. Cut the `v1.0.0-rc.1` tag to anchor release candidates.

This loop has no code changes. It is infrastructure and publishing only.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Prerequisite (manual step before running this prompt)

The current auth token does not have the `workflow` scope needed to push the
`.github/workflows/hardlink-organizer-image.yml` file.

Before starting, run in the terminal:

```bash
gh auth refresh -s workflow
git push origin main
```

Confirm the push succeeded before continuing.

## Read first

1. `.raiden/state/CURRENT_STATE.md`
2. `.github/workflows/hardlink-organizer-image.yml`
3. `packaging/docker/Dockerfile`
4. `packaging/docker/entrypoint.sh`

## Steps

### 1. Verify the push succeeded

Confirm `git status` shows clean and `git log --oneline origin/main` matches
the local `main` tip.

### 2. Verify the GitHub Actions workflow ran

Check the Actions tab for the `hardlink-organizer-image` workflow run triggered
by the push. Confirm it completed without errors.

### 3. Confirm the GHCR package is visible and pullable

- Verify `ghcr.io/starlightdaemon/hardlink-organizer:latest` resolves
- Confirm the package visibility is set to public (not private)
- If the package is private: go to GitHub → Packages → hardlink-organizer →
  Package settings → Change visibility → Public

### 4. Cut the release candidate tag

```bash
git tag v1.0.0-rc.1
git push origin v1.0.0-rc.1
```

Confirm the tag push triggers a versioned image build in Actions and that
`ghcr.io/starlightdaemon/hardlink-organizer:v1.0.0-rc.1` appears.

### 5. Record the canonical image reference

The canonical image reference for all downstream platform work is:

```
ghcr.io/starlightdaemon/hardlink-organizer:latest
```

Versioned reference for 1.0:

```
ghcr.io/starlightdaemon/hardlink-organizer:v1.0.0
```

## Exit criteria

- `git push origin main` has succeeded (19 commits now on remote)
- `hardlink-organizer-image` workflow completed successfully
- GHCR package is public and pullable
- `v1.0.0-rc.1` tag exists and produced a versioned image
- Canonical image name is confirmed and ready for downstream loops to reference

## What this unlocks

- LOOP-012 (Unraid CA): CA XML can reference the real image name
- LOOP-013 (TrueNAS catalog): app.yaml can reference the real image name
- LOOP-014 (OMV): compose file already references the correct image

## Update CURRENT_STATE when done

Mark LOOP-011 complete and add the confirmed canonical image reference to the
Evidence section.
