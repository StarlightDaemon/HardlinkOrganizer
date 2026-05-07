# Prompt 61: Unraid 1.0 — Community Apps (LOOP-012)

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off

## Goal

Take Hardlink Organizer from a validated local Docker image to a live, accepted
Unraid Community Apps listing. This loop supersedes LOOP-009
(`notes/COMMUNITY_APPS_ROADMAP.md`) and executes the same 7-step path now that
the Docker image is public on GHCR.

## Dependency

LOOP-011 (prompt-60) must be complete. The GHCR image must be public and pullable
before this loop starts. Confirm with:

```bash
docker pull ghcr.io/starlightdaemon/hardlink-organizer:latest
```

## Repository root

`/mnt/e/HardlinkOrganizer`

## Read first

1. `.raiden/state/CURRENT_STATE.md`
2. `notes/COMMUNITY_APPS_ROADMAP.md` (the detailed step breakdown)
3. `packaging/unraid/VALIDATION_CHECKLIST.md`
4. `packaging/unraid/templates/` (existing CA XML draft)
5. `packaging/unraid/CA_PUBLISHING_GUIDE.md`
6. `packaging/unraid/SUPPORT_THREAD_DRAFT.md`

## Steps

### Step 1 — Real Unraid host validation

Execute `packaging/unraid/VALIDATION_CHECKLIST.md` on a real Unraid host.
Key checks:
- Container boots with mounted config and data paths
- Web UI reachable at `http://<unraid-ip>:7700`
- Source and destination mounts behave as expected
- Same-device validation blocks cross-pool paths
- Real hardlinks are created successfully
- Collisions skip safely
- Logs and SQLite state persist across container restart

Record any defects. Fix before proceeding.

Exit: checklist executed, defects resolved, results captured in a note.

### Step 2 — Finalize CA XML

Update `packaging/unraid/templates/hardlink-organizer.xml`:
- `Repository` → `ghcr.io/starlightdaemon/hardlink-organizer:latest`
- `Project` → GitHub repo URL (once repo is public)
- `Support` → will be filled after Step 4 (forum thread URL)
- `Icon` → stable URL (GitHub raw or dedicated asset)
- Verify all container path defaults match the real runtime behavior
- No placeholder text anywhere

Exit: XML passes a manual review against the published container.

### Step 3 — Create dedicated CA template repository

CA requires the XML to live in a separate public GitHub repository, not the
main app repo.

- Create a new GitHub repo: `StarlightDaemon/hardlink-organizer-unraid-templates`
- Add `hardlink-organizer.xml` and `ca_profile.xml`
- Add hosted icon asset or confirm stable icon URL
- Verify raw GitHub URLs for all assets resolve correctly

Exit: template repo is public and raw asset URLs resolve.

### Step 4 — Post the Unraid forum support thread

- Use `packaging/unraid/SUPPORT_THREAD_DRAFT.md` as the base
- Update with current product name, GHCR image name, and install steps
- Post to the Unraid Docker Applications subforum
- Copy the thread URL

Exit: thread URL recorded. Update CA XML `Support` field with the real URL.

### Step 5 — Submit to Community Apps

- Go to the CA submission form (linked in `packaging/unraid/CA_PUBLISHING_GUIDE.md`)
- Submit the template repository URL
- Include maintainer details, category, and support link

Exit: submission sent. Record submission date and any confirmation in a note.

### Step 6 — Post-submission follow-up

- Monitor CA review queue for feedback (typically 1–2 weeks)
- Respond to any XML or metadata feedback
- Once accepted: verify `Hardlink Organizer` appears in Community Apps search
- Verify installation via CA on a real Unraid host works end-to-end

Exit: app appears in CA and installs cleanly from the CA UI.

## Exit criteria

- Real Unraid validation passed and defects resolved
- GHCR image is referenced in the final CA XML
- Dedicated template repo exists and is public
- Support thread exists on the Unraid forum
- CA submission sent
- App accepted and installable via Community Apps

## Update CURRENT_STATE when done

Mark LOOP-012 complete and record the CA listing URL in Evidence.
