# CA-STEP-01: Real Unraid Validation Plan

This document expands Stage 2 of the Community Apps roadmap into an execution-ready
plan. Its purpose is to get Hardlink Organizer running on a real Unraid host in Docker,
validate the safety-critical workflow, and capture any defects before GHCR publication
or Community Apps submission.

## Objective

Run Hardlink Organizer on a real Unraid host and prove that:

- the Docker packaging starts cleanly
- the hosted web UI is reachable
- config, logs, and SQLite state persist correctly
- same-device validation behaves correctly on Unraid
- valid hardlinks are created as real hardlinks, not copies
- collisions skip safely without mutating the source payload

## Scope

Included:

- Unraid-side folder prep
- config prep
- Docker bring-up
- first UI access
- scan, preview, dry-run, execution, collision, and persistence checks
- defect capture and classification

Excluded:

- GHCR publishing
- CA XML finalization
- template repository setup
- support-thread publication
- CA submission itself

## Deliverables

At the end of this step we should have:

- a completed operator validation run
- pass or fail notes against `packaging/unraid/VALIDATION_CHECKLIST.md`
- captured defects, if any
- a decision on whether the project is ready for GHCR publication

## Preconditions

Before starting:

1. Unraid host is available and Docker is enabled.
2. This repo is accessible from the machine you will use to prepare files.
3. You have at least one safe test source tree and one safe destination tree.
4. You can choose both:
   - one same-device source/destination pair
   - one different-device source/destination pair for the negative test
5. You are using only disposable or test media content for validation.

## Success criteria

This step passes only if all of the following are true:

- container builds and starts on Unraid
- UI loads on the expected port
- scan works against mounted source paths
- preview works and reports meaningful validation outcomes
- cross-device negative test is refused
- same-device execution creates real hardlinks with matching inode numbers
- repeat execution skips collisions safely
- state and logs persist after restart

## Failure criteria

This step fails if any of the following occur:

- container cannot build or start
- UI is unreachable on LAN
- path mapping between host mounts and config is broken
- same-device validation allows a cross-device operation
- a supposed hardlink ends up as a copy
- the source payload is modified or removed
- state or logs are lost unexpectedly across restart

## Execution phases

### Phase 1: choose test paths

Goal:
- establish safe real test paths before touching Docker

Tasks:
1. Select or create one ingress-style source path with a few files.
2. Select or create one destination path on the same pool or disk.
3. Select a second destination path on a different pool or device for the negative test.
4. Record those paths before editing config.

Output:
- one same-device pair
- one cross-device pair

### Phase 2: prepare appdata and config

Goal:
- make the container boot with stable persistent state

Tasks:
1. Create:
   - `/mnt/user/appdata/hardlink-organizer/`
   - `/mnt/user/appdata/hardlink-organizer/data/`
2. Copy `./config.example.toml` to:
   - `/mnt/user/appdata/hardlink-organizer/config.toml`
3. Edit `config.toml` so:
   - `db_file = "/data/state.db"`
   - `log_file = "/data/hardlink-organizer.log"`
   - `index_json = "/data/index.json"`
   - `index_tsv = "/data/index.tsv"`
4. Set container-side source and destination paths that match the Docker mounts exactly.

Output:
- valid `config.toml` ready for container use

### Phase 3: align Docker mounts

Goal:
- ensure host paths and container paths match config one-to-one

Tasks:
1. Review `packaging/unraid/docker/docker-compose.yml`.
2. Replace example mounts with your real test paths.
3. Confirm every `[source_sets]` entry points to a mounted `/mnt/src/...` path.
4. Confirm every `[dest_sets]` entry points to a mounted `/mnt/dst/...` path.

Output:
- compose file aligned with config and host reality

### Phase 4: bring up the container

Goal:
- prove Docker packaging is runnable on Unraid

Tasks:
1. Run:
   - `docker compose -f packaging/unraid/docker/docker-compose.yml up -d`
2. Check status:
   - `docker ps`
3. Inspect logs:
   - `docker logs hardlink-organizer`

Expected:
- container is running
- `uvicorn` is listening on `0.0.0.0:7700`

Output:
- running container or first defect report

### Phase 5: first UI verification

Goal:
- prove operator access works before deeper workflow testing

Tasks:
1. Open:
   - `http://<unraid-ip>:7700`
2. Confirm the dashboard loads without obvious client-side failure.

Expected:
- page renders and shows the Hardlink Organizer UI

Output:
- UI reachable yes or no

### Phase 6: scan and inventory verification

Goal:
- prove the app can see mounted sources and persist scan state

Tasks:
1. Run a scan from the UI.
2. Verify inventory appears.
3. Verify:
   - `/mnt/user/appdata/hardlink-organizer/data/state.db`
4. Optionally verify JSON and TSV outputs if configured.

Expected:
- entries appear in UI
- state DB exists and updates

Output:
- successful scan record or scanner defect

### Phase 7: preview and safety validation

Goal:
- verify mapping and same-device guard behavior before real writes

Tasks:
1. Choose a valid same-device source entry and preview it.
2. Confirm the resulting destination path looks correct.
3. Run the negative cross-device preview using the alternate destination set.

Expected:
- valid pair previews successfully
- cross-device pair is refused clearly

Output:
- preview evidence for both positive and negative cases

### Phase 8: dry-run and real execution

Goal:
- validate execution behavior without and with mutation

Tasks:
1. Run a dry-run for a valid same-device selection.
2. Confirm no destination files are created.
3. Run the real link action.
4. Confirm destination files now exist.

Expected:
- dry-run reports planned actions only
- real run creates linked destination files

Output:
- dry-run evidence
- real execution evidence

### Phase 9: inode and collision verification

Goal:
- prove hardlink fidelity and safe repeat behavior

Tasks:
1. Use `ls -i` on a source file and its linked destination file.
2. Confirm inode numbers match.
3. Repeat the same link action.
4. Confirm the result reports skips instead of overwrites.

Expected:
- matching inode numbers
- second run reports skipped collisions

Output:
- fidelity evidence
- collision evidence

### Phase 10: persistence and restart verification

Goal:
- prove the app survives restart with preserved state

Tasks:
1. Restart the container.
2. Reload the UI.
3. Confirm scan history or inventory-backed state is still present.
4. Confirm log and DB files remain under `/mnt/user/appdata/hardlink-organizer/data/`.

Expected:
- state survives restart

Output:
- persistence evidence

## Defect capture format

If anything fails, record:

- phase
- exact command or UI action
- expected result
- actual result
- logs or screenshot reference
- severity:
  - blocker
  - major
  - minor
- likely area:
  - Docker packaging
  - config
  - web UI
  - engine
  - filesystem behavior

## Operator output template

Record these fields when you run the validation:

- Date:
- Unraid version:
- Docker version:
- Test source path:
- Same-device destination path:
- Cross-device destination path:
- Container start result:
- UI access result:
- Scan result:
- Negative test result:
- Dry-run result:
- Real link result:
- Inode verification result:
- Collision result:
- Persistence result:
- Overall status:
- Defects found:

## Exit decision

After this step, choose one:

1. `PASS`
   - move to `CA-STEP-02` GHCR publication
2. `PASS WITH MINOR DEFECTS`
   - fix small issues first, then move to GHCR publication
3. `FAIL`
   - stop CA progression and resolve defects before publication

## Immediate next step after this document

When the operator is ready:

1. prepare the real Unraid paths
2. edit `config.toml`
3. edit `docker-compose.yml`
4. bring up the container
5. walk through `packaging/unraid/VALIDATION_CHECKLIST.md`

## Provenance

- Date: 2026-04-15
- Basis: `notes/COMMUNITY_APPS_ROADMAP.md`, current packaging docs, current validation checklist, and current Docker compose layout
- Confidence: high
