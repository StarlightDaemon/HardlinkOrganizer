# Your First Hardlink — Step-by-Step Guide

This guide walks through hardlinking a single download from start to finish
using the demo data bundled in the repo. Everything runs locally — no Docker
required.

---

## Before You Start

**Requirement:** Python 3.10+ and the project dependencies installed.

```bash
cd /path/to/HardlinkOrganizer
pip install -r requirements.txt
```

**Same-device rule:** Hardlinks only work when the source and destination are on
the same physical filesystem (same disk/partition). If you see a
`different_device` error in Preview, the paths are on separate mounts.

---

## Step 0 — Pick Your Config

The repo ships a `config.demo.toml` that points at the `demo_data/` folder so
you can run through the full workflow without touching real files.

```bash
# Demo run (safe, uses demo_data/)
python3 webapp/run.py --config config.demo.toml

# Real run (edit config.toml first with your actual paths)
python3 webapp/run.py --config config.toml
```

Open your browser at `http://localhost:8000` (demo) or `http://localhost:7700`
(default real config).

---

## Step 1 — Source: Pick and Scan

The first screen shows your configured **source sets** — these are your ingress
or download folders.

> **Testing focus:** Movies are well-understood and generally link correctly
> without issues. Use **shows** for any new testing — episode files, season
> folders, and multi-file entries are where edge cases tend to surface.

1. Click the `shows` source set.
2. The app triggers a scan immediately on click. Wait for the green
   **Scan complete** toast.
3. The source card updates with an item count and last-scan time.
4. Click **Next** (or the step bar) to continue.

> If the set was already scanned recently, clicking it again still re-scans so
> you pick up any new files dropped since last time.

---

## Step 2 — Browse: Find Your Download

The Browse step shows everything the scan found in that source set.

1. Use the **search box** at the top to filter by name if the list is long.
2. Click the row for the show season you want to hardlink (e.g. `The Expanse S01`).
   The row highlights to confirm selection.
3. Click **Next**.

> The table shows display name, size, and file count. Clicking a row sets the
> active entry — only one item can be linked per workflow run. For shows, each
> season folder is one entry; all episode files inside link together.

---

## Step 3 — Destination: Choose Where It Goes

1. Click the `shows` destination set.
2. Enter a **subpath** matching the show and season — this is important for
   shows so episodes don't land flat in the library root.

   Example subpath: `The Expanse/Season 01` → episodes land at
   `<dest_root>/The Expanse/Season 01/S01E01.mkv`

3. Click **Preview** and wait for the response.

> Subpath structure is your call — use whatever convention your media server
> expects (Plex, Jellyfin, and Emby all prefer `Show Name/Season XX/` layout).

---

## Step 4 — Preview: Read Before You Write

The Preview step shows the exact source and destination paths that will be
written, plus any warnings before any files are touched.

**Read every section:**

| Section | What to check |
|---|---|
| **Source path** | Is this the right file/folder? |
| **Destination path** | Does the final path look correct? |
| **Warnings** | Expand any warning with `▸` — mount layout issues appear here |
| **Files** | Count matches what you expect |

**Common warnings and what to do:**

- `unraid_user_share` — destination is under `/mnt/user`; acceptable but note
  the caveat about union mounts and inode identity.
- `mergerfs_pool_path` — same as above for OMV/MergerFS setups.
- `different_device` — **stop here**; source and destination are on different
  filesystems; hardlinks cannot cross device boundaries. Fix the config paths.

If everything looks correct, check the **confirmation checkbox** and click
**Execute**.

---

## Step 5 — Result: Verify It Worked

The Result screen shows the outcome of the execute call.

- **Linked** count: files successfully hardlinked.
- **Skipped** count: files that already existed at the destination
  (`collision_policy = "skip"`).
- **Failed** count: any errors. Expand the list to see which files and why.

A fully successful run shows `linked = N, skipped = 0, failed = 0`.

---

## Step 6 — Confirm on Disk (Optional but Recommended)

Check that the hardlink actually shares the same inode as the source:

```bash
# Replace paths with your actual source and destination
ls -i "demo_data/ingress/shows/The Expanse S01/S01E01.mkv"
ls -i "demo_data/library/shows/The Expanse/Season 01/S01E01.mkv"
```

Both lines should show the **same inode number** (the first column). If they
match, the hardlink is correct — both paths point to exactly one copy of the
data on disk.

---

## Workflow at a Glance

```
Source (scan)  →  Browse (pick)  →  Destination (set + subpath)
     →  Preview (read warnings)  →  Execute  →  Result
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Source set shows no items | Scan hasn't run or path is wrong | Click the set to rescan; check `config.toml` paths |
| Preview fails with `different_device` | Source and dest are on different mounts | Move dest to same device as source |
| `linked = 0, skipped = N` | Files already exist at destination | Normal if re-running; check dest folder if unexpected |
| Toast says "Scan failed" | Path doesn't exist on the host | Check `[source_sets]` in your config |
| Nothing at `localhost:7700` | Server not running | Re-run `python3 webapp/run.py --config config.toml` |

---

## Using the Demo Data

The `demo_data/` tree ships with placeholder files for a quick smoke-test:

```
demo_data/
  ingress/
    movies/  Inception (2010).mp4  Interstellar (2014).mkv
    shows/   The Expanse S01/S01E01.mkv  S01E02.mkv
  library/
    movies/  (empty — hardlinks land here)
    shows/   (empty — hardlinks land here)
```

Run with `config.demo.toml`, link `The Expanse S01` to `shows` with subpath
`The Expanse/Season 01`, and verify the inode numbers match. That's the full
loop on safe throwaway data — and it exercises the multi-file/season-folder
path that movies skip.

---

## Next Steps

- **Destinations tab** — add and validate library paths without editing the TOML
  directly.
- **History sidebar** — review past link runs and re-run verification at any
  time.
- **Verify** — run a verification pass on a previous job to confirm all hardlinks
  are still intact.
