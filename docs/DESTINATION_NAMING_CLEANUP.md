# Destination-side naming cleanup

Hardlink Organizer can tidy the names of entries that already live inside a
registered destination — for example turning a scene-style folder like
`The.Matrix.1999` into `The Matrix (1999)` — without ever touching your source
files.

This is the destination counterpart to the source-side display-name logic used
during linking. It is **preview-first, source-safe, and non-destructive by
default.**

## Where it lives

- **UI:** *Destination Registry* tab → a destination row's action menu →
  **Clean names**.
- **API:**
  - `GET  /api/destinations/{id}/naming/preview` — compute proposals; never
    writes.
  - `POST /api/destinations/{id}/naming/apply` — apply (or dry-run) an explicit
    list of renames. `dry_run` defaults to `true`.
  - `GET  /api/destinations/{id}/naming/history` — the persisted audit trail of
    applied renames for that destination.

## Workflow

1. Open **Clean names** for a destination. The panel loads a preview of every
   top-level entry and shows the proposed tidied name beside the current one.
2. Entries that are already clean, or whose tidied name would collide with an
   existing entry, are shown but cannot be selected.
3. Select the renames you want. Run **Preview selected (dry run)** to see exactly
   what would happen — nothing is written.
4. Click **Apply renames…**, then **Confirm**. Only then are the selected
   entries renamed on disk.

## Safety model

The design does not widen destructive power. Specifically:

- **Dry-run by default.** The apply request defaults to `dry_run: true`; the
  destructive branch is never the default and, in the UI, requires an explicit
  confirm click.
- **Cleanup only, never arbitrary renames.** The server recomputes the canonical
  tidied name for each entry and applies a rename only if the requested target
  matches it exactly. The endpoint cannot be used as a general-purpose rename
  tool.
- **In-place only.** Proposed names are always a single path component; path
  separators and traversal tokens (`/`, `\`, `.`, `..`) are rejected, so a
  rename can never be redirected into another directory.
- **Source-safe, fail-closed.** Any entry that resolves under a configured
  source set is refused (symlinks are resolved before the check). In addition,
  a real (non-dry-run) apply is refused outright when no source sets are
  configured — the containment check would be inert — or when the destination
  path overlaps a configured source root in either direction. Renames operate
  solely on destination entries.
- **No clobbering.** For files and symlinks the rename is enforced atomically:
  the entry is hardlinked to the new name first (`link` + `unlink`), which
  fails if anything — including a broken symlink, or an entry created after the
  pre-check — already holds the target name; such items are skipped. Directory
  renames are guarded by a pre-check, and POSIX `rename()` itself refuses a
  non-empty directory target; the only theoretical residual window is an
  *empty* directory created at the target name in the instant between the
  pre-check and the rename.
- **Audit-friendly.** Every real rename and every failure is written to the
  `naming_cleanup_ops` table and is reviewable via the history endpoint. Dry-run
  previews write nothing.

## Unraid / MergerFS filesystem constraints

Creating a *new* hardlink can fail with `EXDEV` when a share-style path such as
`/mnt/user/...` (Unraid shfs) or `/srv/mergerfs/...` (MergerFS) hides the real
per-disk layout. Naming cleanup is a **different operation** and does **not**
carry that risk:

- An in-place rename within a single directory is a **metadata-only** operation.
  It does not relocate data across disks.
- The entry keeps the **same inode**, so any hardlink back to the source file is
  **preserved** — the two names still point at the same physical data.

Because of this, cleaning names under `/mnt/user` or `/srv/mergerfs` is safe. The
preview surfaces an informational note explaining exactly this, rather than
discouraging the action. Source files are never renamed regardless of layout.
