# Prompt 63: OMV 1.0 — Community Release (LOOP-014)

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off

## Goal

Validate Hardlink Organizer on OpenMediaVault and establish community presence
so OMV users can discover and deploy it. OMV has no central app marketplace —
the path is polished docs, validated compose files, and targeted forum/community
posts.

## Dependency

LOOP-011 (prompt-60) must be complete. The GHCR image must be public.

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `.raiden/state/CURRENT_STATE.md`
2. `packaging/omv/README.md`
3. `packaging/omv/docker-compose.yml`
4. `packaging/docker/Dockerfile`

## Background on OMV deployment paths

OpenMediaVault 6+ users typically deploy Docker apps via:

1. **openmediavault-compose plugin** — the most common path; provides a GUI
   for managing compose stacks directly in the OMV web UI. Users paste a
   compose file or point to a Git URL.

2. **Direct Docker / Portainer** — OMV ships without Docker by default but
   most users add it. Portainer is often co-installed.

3. **omv-extras** — the OMV community plugin system. Adding HLO here would
   require a plugin package, which is heavyweight and not worth pursuing for 1.0.

Target path for 1.0: compose plugin + Portainer stack. No omv-extras plugin.

## Steps

### Step 1 — Review and polish existing OMV packaging

Audit `packaging/omv/`:
- `README.md`: verify all paths, PUID/PGID instructions, and the compose plugin
  workflow are accurate
- `docker-compose.yml`: confirm it uses the GHCR image
  (`ghcr.io/starlightdaemon/hardlink-organizer:latest`), correct port, and
  appropriate volume labels
- Add a section to the README for Portainer stack deployment (paste-and-deploy
  pattern, no file needed on disk)

### Step 2 — Validate on an OMV host

Test on a real OMV 6+ host (or a close equivalent):
- Deploy via the compose plugin or direct `docker compose up`
- Verify:
  - Container starts with correct PUID/PGID
  - Web UI reachable at `http://<omv-ip>:7700`
  - Config and data volumes persist across restart
  - Mount layout warning fires correctly for MergerFS paths
  - Source/dest on the same underlying disk creates hardlinks correctly

Record any issues. Fix before posting publicly.

### Step 3 — Write a community post

Draft a post for the OMV community forum (forums.openmediavault.org) or the
r/OpenMediaVault subreddit. Include:
- One-paragraph description of what HLO does and why it's useful on OMV
- Minimal deploy snippet (the compose block)
- Link to GitHub repo
- Note about same-device mount requirement (mergerfs pool awareness)
- Where to report issues (GitHub Issues)

Also consider:
- Adding to the `awesome-omv` list if one exists
- A post in the Portainer community if there is a relevant Docker apps channel

### Step 4 — Add Portainer template entry (optional but preferred)

If a `portainer-templates.json` does not already exist in `packaging/portainer/`,
create or update it to include HLO as a deployable app template. This makes HLO
discoverable from Portainer's App Templates panel, which OMV users with Portainer
installed can use without needing to touch a shell.

Template entry should include:
- title, description, logo (icon URL)
- image: `ghcr.io/starlightdaemon/hardlink-organizer:latest`
- env vars: `PUID`, `PGID`, `TZ`
- volumes for config and data
- port: 7700

## Exit criteria

- `packaging/omv/README.md` and `docker-compose.yml` are polished and reference
  the real GHCR image
- Deployment validated on a real OMV host (or documented workaround if no host
  available)
- Community post published (forum, Reddit, or both)
- Portainer template entry exists in `packaging/portainer/`

## Update CURRENT_STATE when done

Mark LOOP-014 complete and record the community post URL(s) in Evidence.
