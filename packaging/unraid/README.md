# Hardlink Organizer — Unraid Packaging

This directory contains packaging assets for hosting the Hardlink Organizer web app
on an Unraid server.

Commands below assume your working directory is the Hardlink Organizer root.

## Hosting model

The recommended approach is a **lightweight Docker container** running the FastAPI
Python web application. This is not a VM-style deployment — it is simply the
cleanest way to manage dependencies and path isolation on Unraid.

### What the container does

- Runs `uvicorn` serving the FastAPI web app on a configurable port (default: 7700)
- Reads a TOML config file from a host-mounted path
- Stores scan history and link records in a SQLite database at a host-mounted path
- Accesses source and destination filesystem roots via explicit host mounts

## GitHub image publishing

This repository is prepared to build and publish the Docker image with GitHub Actions.

### Workflow

- Workflow file: `.github/workflows/hardlink-organizer-image.yml`
- Registry target: `ghcr.io/<github-owner>/hardlink-organizer`

### What it does

- builds the image on pull requests for validation
- builds and pushes branch-tagged images on pushes to `main`
- builds and pushes versioned images on tags like `v1.0.0-rc.1`
- publishes `latest` only for version tags

### Prerequisites

- the repository must be pushed to GitHub
- GitHub Actions must be enabled
- the repository package permissions must allow publishing to GHCR with `GITHUB_TOKEN`

### Recommended release flow

1. Merge Docker-related changes to `main`
2. Verify the GitHub Actions build succeeds
3. Create and push a version tag such as `v1.0.0-rc.1`
4. Pull the published image from GHCR on Unraid

## Community Apps publishing prep

This repository also includes draft assets for eventual Community Apps publication:

- draft XML template: `packaging/unraid/templates/hardlink-organizer.xml`
- maintainer profile draft: `packaging/unraid/templates/ca_profile.xml`
- support thread draft: `packaging/unraid/SUPPORT_THREAD_DRAFT.md`
- publication guide: `packaging/unraid/CA_PUBLISHING_GUIDE.md`

Recommended workflow:

- publish the Docker image to GHCR first
- create the real Unraid support thread
- move or copy the template assets into a dedicated template repository
- submit that repository to Community Apps

---

## Required host mounts

For reliable Unraid hardlink execution, prefer a single shared disk-level or
pool-level parent bind mount. Real beta validation showed that preview can pass
while real execution still fails with `EXDEV` when source and destination are
mounted separately or routed through `/mnt/user`.

### Recommended layout

| Container path | Host example   | Purpose |
|----------------|----------------|---------|
| `/config`      | `/mnt/user/appdata/hardlink-organizer/`      | Config file location |
| `/data`        | `/mnt/user/appdata/hardlink-organizer/data/` | SQLite DB and log files |
| `/mnt/disk3`   | `/mnt/disk3`   | Shared parent mount for both source and destination paths |

Then point config paths inside that single shared mount, for example:

```toml
[source_sets]
movies = "/mnt/disk3/ingress/movies"

[dest_sets]
movies = "/mnt/disk3/media/movies"
```

### Higher-risk layout

| Container path   | Host example                     | Purpose                         |
|-----------------|----------------------------------|---------------------------------|
| `/config`       | `/mnt/user/appdata/hardlink-organizer/`         | Config file location            |
| `/data`         | `/mnt/user/appdata/hardlink-organizer/data/`    | SQLite DB and log files         |
| `/mnt/src/movies`  | `/mnt/user/ingress/movies`    | Source set — movies             |
| `/mnt/src/shows`   | `/mnt/user/ingress/shows`     | Source set — shows              |
| `/mnt/dst/movies`  | `/mnt/user/media/movies`      | Destination set — movies        |
| `/mnt/dst/shows`   | `/mnt/user/media/shows`       | Destination set — shows         |

Add one mount per configured source and destination set. The paths you configure
in `config.toml` inside the container must match the container-side paths above.

This separate-mount pattern is still supported for now, but it is higher risk on
Unraid. Even when preview reports the same device ID, real hardlink execution can
still fail with `EXDEV` because the source and destination resolve through
different container mounts or through `/mnt/user`.

> **Important**: Source and destination paths must resolve to the same underlying
> device and should ideally live under one shared parent mount. The tool validates
> device IDs at runtime before any hardlink is attempted and now emits preview
> warnings for risky Unraid layouts. Cross-device operations are still refused.

---

## Installing via the Unraid Docker UI

This is the primary self-serve path if you are not using the Community Apps plugin
or a Compose Manager workflow.

### Step 1 — Pre-flight (SSH into Unraid)

Create the appdata directories and fetch the config template **before** the
container first starts. The container will exit immediately on startup if
`config.toml` is missing.

```bash
mkdir -p /mnt/user/appdata/hardlink-organizer/data
wget -O /mnt/user/appdata/hardlink-organizer/config.toml \
  https://raw.githubusercontent.com/StarlightDaemon/HardlinkOrganizer/main/config.example.toml
```

### Step 2 — Edit config.toml

Open the config and update all paths so they point inside your container-side
mounts (see [Required host mounts](#required-host-mounts)). Prefer paths that sit
inside one shared `/mnt/diskX/...` or pool-level parent mount:

```bash
nano /mnt/user/appdata/hardlink-organizer/config.toml
```

```toml
[paths]
db_file    = "/data/state.db"
log_file   = "/data/hardlink-organizer.log"
index_json = "/data/index.json"
index_tsv  = "/data/index.tsv"

[source_sets]
movies = "/mnt/disk3/ingress/movies"
shows  = "/mnt/disk3/ingress/shows"

[dest_sets]
movies = "/mnt/disk3/media/movies"
shows  = "/mnt/disk3/media/shows"

[webapp]
host = "0.0.0.0"
port = 7700
```

### Step 3 — Add Container

In the Unraid UI: **Docker** tab → **Add Container**

**Basic settings:**

| Field | Value |
|-------|-------|
| Name | `hardlink-organizer` |
| Repository | `starlightdaemon/hardlink-organizer:latest` |
| Network Type | `Bridge` |
| WebUI | `http://[IP]:[PORT:7700]/` |
| Icon URL | `https://raw.githubusercontent.com/StarlightDaemon/HardlinkOrganizer/main/packaging/unraid/assets/hardlink-organizer.svg` |

**Port** — click **Add another Path, Port, Variable, Label or Device** → Port:

| Name | Container Port | Host Port | Connection Type |
|------|---------------|-----------|-----------------|
| Web UI | `7700` | `7700` | TCP |

Change the host port only if `7700` is already in use on your server.

**Paths** — click **Add another Path, Port, Variable, Label or Device** → Path,
once per row:

| Name | Container Path | Host Path | Access Mode |
|------|---------------|-----------|-------------|
| Config | `/config` | `/mnt/user/appdata/hardlink-organizer` | Read/Write |
| Data | `/data` | `/mnt/user/appdata/hardlink-organizer/data` | Read/Write |
| Disk mount | `/mnt/disk3` | `/mnt/disk3` | Read/Write |

Replace `/mnt/disk3` with the actual disk or pool root that contains both your
source and destination paths. If your paths span multiple disks, add one row per
disk and keep your `config.toml` source/dest paths aligned to the container-side
mount points.

**Variables** — click **Add another Path, Port, Variable, Label or Device** →
Variable:

| Name | Key | Value |
|------|-----|-------|
| User ID | `PUID` | `1000` |
| Group ID | `PGID` | `1000` |

Run `id -u` and `id -g` on your Unraid host to find your actual UID/GID.

### Step 4 — Apply and verify

Click **Apply**. Unraid will pull the image and start the container.

Confirm it started cleanly:

```bash
docker logs hardlink-organizer
```

You should see `Starting Hardlink Organizer` followed by uvicorn startup lines. If
the container exits immediately, the most common cause is a missing or malformed
`config.toml` — re-check steps 1 and 2.

### Step 5 — Open the UI

`http://<unraid-ip>:7700`

---

## Installing via Docker Compose

Use this path if you have the Compose Manager Unraid plugin, or are deploying via
SSH with a compose file.

### 1. Get the config template

Fetch it on the Unraid host:

```bash
mkdir -p /mnt/user/appdata/hardlink-organizer/data
wget -O /mnt/user/appdata/hardlink-organizer/config.toml \
  https://raw.githubusercontent.com/StarlightDaemon/HardlinkOrganizer/main/config.example.toml
```

Or, if you have the repository cloned locally:

```bash
cp ./config.example.toml /mnt/user/appdata/hardlink-organizer/config.toml
```

### 2. Edit config.toml

Update all paths to match your container-side mount points. Prefer paths that sit
inside one shared `/mnt/diskX/...` or pool-level parent mount:

```toml
[paths]
db_file   = "/data/state.db"
log_file  = "/data/hardlink-organizer.log"
index_json = "/data/index.json"
index_tsv  = "/data/index.tsv"

[source_sets]
movies = "/mnt/disk3/ingress/movies"
shows  = "/mnt/disk3/ingress/shows"

[dest_sets]
movies = "/mnt/disk3/media/movies"
shows  = "/mnt/disk3/media/shows"

[webapp]
host = "0.0.0.0"
port = 7700
```

### 3. Start the container

```bash
docker compose -f packaging/unraid/docker-compose.yml up -d
```

This pulls the image from Docker Hub on first start.

### 4. Access the UI

Open a browser on your LAN: `http://<unraid-ip>:7700`

---

## CLI fallback

If the web UI is unavailable, you can run the CLI directly inside the container:

```bash
docker exec -it hardlink-organizer \
  python hardlink_organizer.py --config /config/config.toml interactive
```

---

## Path safety notes

- `/mnt/user` paths in Unraid can appear compatible while actually resolving to
  different devices or different execution contexts. The tool validates device IDs
  at runtime using `os.stat().st_dev`, but same-device preview is not enough to
  prove that a risky mount layout will execute successfully.
- Separate source and destination bind mounts can still fail with `EXDEV` on
  Unraid even when they appear to share the same device ID.
- Prefer a shared disk-level parent mount such as `/mnt/disk3:/mnt/disk3` and
  keep both source and destination config paths under that mount.
- Always validate before your first real link operation using the Preview step
  and treat mount-layout warnings as a signal to fix the container mounts first.
- The source payload is never moved, renamed, or deleted.

---

## Upgrade procedure

```bash
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d --force-recreate
```

Config and database are preserved via host mounts across upgrades.

---

## Uninstall

1. Stop and remove the container: `docker compose down`
2. Optionally remove the image: `docker rmi hardlink-organizer`
3. Optionally remove `/mnt/user/appdata/hardlink-organizer/` (config, DB, logs)

No system-level residue is left beyond Docker artifacts and the appdata directory.
