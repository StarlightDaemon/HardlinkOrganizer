# Agent Task: Build TrueNAS SCALE Catalog Entry (LOOP-013 Step 1+2)

You are a Claude Code agent. Your task is to research the TrueNAS SCALE community
app catalog format and produce the catalog files for Hardlink Organizer. When done,
commit the files and report what was created.

**Do not** do host validation, fork the upstream repo, or open a PR. Those are
human steps that come after this. Your job ends at: files written and committed.

---

## Repository root

`/mnt/e/HardlinkOrganizer`

Always confirm you are in this directory before doing any work.

## Read these files first — no exceptions

1. `.raiden/state/CURRENT_STATE.md` — project state and confirmed facts
2. `packaging/truenas/README.md` — existing TrueNAS docs
3. `packaging/truenas/docker-compose.yml` — existing compose (your starting point)
4. `packaging/docker/Dockerfile` — canonical image definition
5. `packaging/docker/entrypoint.sh` — PUID/PGID privilege drop details
6. `packaging/unraid/assets/hardlink-organizer.svg` — confirm icon asset exists

## Research step — do this before writing any files

Fetch the TrueNAS community apps catalog to understand the current required format:

1. Fetch the repo root to see the directory structure:
   `https://raw.githubusercontent.com/truenas/apps/master/README.md`
   or browse `https://github.com/truenas/apps/tree/master/ix-dev/community`

2. Find a simple, recently-merged community app that is a single-container web UI
   (not a database-heavy or multi-service stack). Good search terms: look for apps
   with a single service, port mapping, and volume mounts — similar to what HLO needs.

3. Read that reference app's `app.yaml` and `docker-compose.yml` in full.

4. Note:
   - Exact required fields in `app.yaml` (especially `lib_version`, `lib_version_hash`,
     `run_as_context`, `capabilities`, and `train`)
   - How volumes are declared in the compose (named volumes vs host paths)
   - Whether `version:` in compose must be omitted (Compose V2 spec drops it)
   - Any `x-` extension keys the catalog uses

If the GitHub structure has changed significantly from what is described in
`prompt-62-truenas-scale-catalog.md`, use what you actually observe, not the
prompt template.

## Files to create

Create the directory `packaging/truenas/catalog/` and write these three files.

### `packaging/truenas/catalog/app.yaml`

Build from your research. Required fields at minimum:

- `app_version`: `"1.0.0"`
- `capabilities`: `[]` (HLO needs no special Linux capabilities)
- `categories`: `["storage", "utilities"]`
- `description`: one sentence — what HLO does
- `home`: `https://github.com/StarlightDaemon/HardlinkOrganizer`
- `host_mounts`: `[]`
- `icon`: `https://raw.githubusercontent.com/StarlightDaemon/HardlinkOrganizer/main/packaging/unraid/assets/hardlink-organizer.svg`
- `keywords`: `["hardlink", "media", "nas", "storage"]`
- `lib_version` and `lib_version_hash`: copy from your reference app (they track
  the catalog library version, not HLO's version)
- `run_as_context`: set uid/gid to 568 (TrueNAS `apps` user convention) with a
  description noting that PUID/PGID env vars override this at runtime
- `title`: `"Hardlink Organizer"`
- `train`: `"community"`
- `version`: `"1.0.0"`

If the reference app uses additional required fields not listed above, include them.

### `packaging/truenas/catalog/docker-compose.yml`

Base this on `packaging/truenas/docker-compose.yml` with these adjustments:

- Remove the `build:` block — catalog apps pull from a registry, never build locally
- Image: `ghcr.io/starlightdaemon/hardlink-organizer:latest`
- Remove the `version:` top-level key if Compose V2 spec does not use it
- Use named volumes with appropriate labels if the catalog convention requires it
  (check your reference app)
- Keep PUID, PGID, TZ env vars
- Keep the port 7700 mapping
- Volume mount paths should use the TrueNAS dataset path conventions from the
  existing `packaging/truenas/docker-compose.yml`
- Keep the restart policy: `unless-stopped`

### `packaging/truenas/catalog/README.md`

This is shown in the SCALE UI app detail view. Keep it short — users read this
before clicking Install.

Sections:
1. **What is Hardlink Organizer** — 2-3 sentences
2. **Mount layout requirement** — source and destination must be on the same pool;
   explain why (cross-device hardlinks fail)
3. **PUID / PGID** — set these to match the TrueNAS user that owns your datasets
4. **Access** — `http://<truenas-ip>:7700` after install
5. **First run** — copy `config.example.toml` to the config volume and edit paths

## After writing the files

1. Run `git diff --stat` to confirm only the three new files are staged
2. Commit:

```bash
git add packaging/truenas/catalog/
git commit -m "feat: add TrueNAS SCALE catalog entry (LOOP-013 step 1+2)"
```

3. Report back:
   - What reference app you used and what you learned from it
   - Any differences between the prompt-62 template and the actual current catalog format
   - The three files created and their key contents
   - Any open questions for the human before the PR submission step

## What NOT to do

- Do not modify any existing files outside `packaging/truenas/catalog/`
- Do not open a PR or fork `truenas/apps` — that is a human step
- Do not attempt host validation
- Do not update CURRENT_STATE.md — this is a sub-agent task; the human will update state
- Do not widen scope to OMV, Unraid, or any other platform
