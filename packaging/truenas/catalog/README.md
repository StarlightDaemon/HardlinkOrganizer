# Hardlink Organizer — TrueNAS SCALE Catalog

This directory is the TrueNAS SCALE community app catalog entry for
**Hardlink Organizer**. It is structured for submission to the
[truenas/apps](https://github.com/truenas/apps) repository under
`ix-dev/community/hardlink-organizer/`.

## Files

| File | Purpose |
|---|---|
| `app.yaml` | App metadata (title, icon, categories, lib version, run_as context) |
| `ix_values.yaml` | Static image reference and internal port constants |
| `questions.yaml` | SCALE UI configuration schema (storage, network, user/group) |
| `templates/docker-compose.yaml` | Jinja2 template — rendered by the catalog at install time |
| `templates/test_values/basic-values.yaml` | CI test scenario used by `truenas/apps` CI pipeline |
| `README.md` | This file (catalog submission notes) |

The file `docker-compose.yml` in this directory is a **human-readable reference
compose** for manual deployment and local testing; it is not part of the catalog
submission.

## What is Hardlink Organizer

[Hardlink Organizer](https://github.com/StarlightDaemon/HardlinkOrganizer) is a
preview-first web UI for safely planning and executing hardlinks across NAS
storage pools. It scans a source dataset, previews the hardlink plan with
per-file status, and lets you commit or roll back with one click — with a full
history of every link job stored in SQLite.

## Mount layout requirement

**Source and destination datasets must reside on the same ZFS pool.**
Hardlinks cannot cross device boundaries (i.e., different pools). Both paths
must be mounted into the container from the same pool.

Example: mount `/mnt/tank/media` to `/mnt/media` inside the container, then set
`source_sets.movies = "/mnt/media/ingress/movies"` and
`dest_sets.movies = "/mnt/media/library/movies"` in `config.toml`.

## PUID / PGID

Set **User ID** and **Group ID** in the SCALE UI to match the TrueNAS user that
owns your media datasets:

```bash
# On the TrueNAS shell
id <your-user>
```

These values are passed to the container as `PUID`/`PGID` and applied at
startup via the `gosu` entrypoint. The default (568 / `apps`) is used only if
you do not override them.

## Access

After installation, open: `http://<truenas-ip>:7700`

The port can be changed in the Network Configuration group during installation.

## First run

1. In the **Storage Configuration** group, set your Config storage to a host
   path or let the system create an ixVolume.
2. After the app starts, open a shell on the TrueNAS host and copy the example
   config into your config volume:
   ```bash
   cp /path/to/config.example.toml /mnt/tank/apps/hlo-config/config.toml
   ```
3. Edit `config.toml` and set `source_sets` and `dest_sets` to match your
   dataset paths as mounted into the container.
4. Reload the web UI — your configured sets will appear in the workflow stepper.

## PR submission notes

Before submitting to `truenas/apps`:

- Replace `icon:` URL in `app.yaml` with the CDN URL provided by the PR reviewer.
- Add screenshot URLs once hosted on the TrueNAS CDN.
- Verify that LOOP-011 (GHCR image publication) is complete and
  `ghcr.io/starlightdaemon/hardlink-organizer:1.0.0` is publicly pullable.
- Run the catalog CI locally (`python .github/scripts/ci.py`) before filing the PR.
