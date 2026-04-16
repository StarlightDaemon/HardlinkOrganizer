# Hardlink Organizer Feature Expansion Plan

This document converts the current feature requests into an implementation-oriented
plan for post-beta development of Hardlink Organizer on Unraid.

## Scope

This plan covers:

- hard link verification
- destination management in the web app
- destination-side naming cleanup and normalization
- Unraid-specific container and mount strategy
- general UX and safety expectations for future features

This plan does not replace the Community Apps roadmap. It is the feature roadmap
that should be executed alongside or after packaging and publication work, depending
on release timing.

## Product constraints

- Platform: Unraid, Dockerized deployment
- Primary audience: less-technical Unraid users using a web UI
- Safety posture: preview-first, review-first, no destructive defaults
- Filesystem reality: true hardlinks depend on same-filesystem semantics, and Unraid
  share paths can hide underlying disk layout in ways that mislead path-only logic

## Confirmed real-host finding

Real Unraid validation established an important deployment constraint:

- separate bind mounts for source and destination can still produce `EXDEV`
  cross-device hardlink failures, even when both paths resolve to the same physical disk
- a shared parent mount such as `/mnt/disk3 -> /mnt/disk3` inside the container
  is the more reliable layout for true hardlink execution

This finding should shape future verification logic, destination validation, and
deployment documentation.

## Feature breakdown

### 1. Existing hard link verification

#### Goal

Allow the user to verify whether expected hardlinked items are actually hardlinked.

#### Core capability

- user selects:
  - a source set and destination set
  - a specific prior hardlink job
  - or a manual source and destination path pair
- app enumerates candidate source and destination files
- app compares:
  - destination existence
  - `st_dev`
  - `st_ino`
  - `st_nlink`
  - size
  - file type
- app reports status per item and in aggregate

#### Required verification statuses

- `verified_hardlinked`
- `exists_but_not_hardlinked`
- `missing_at_destination`
- `candidate_match_ambiguous`
- `cannot_verify_cross_filesystem`
- `cannot_verify_permission_error`
- `cannot_verify_symlink`

#### Verification rules

- inode and device must both match for proof
- filename similarity is only a candidate match, never proof
- symlinks are not valid hardlinks
- link count should be surfaced, but not treated as sole proof
- one source may map to multiple valid hardlinked destinations

#### Proposed implementation decision

Use a two-stage verification pipeline:

1. candidate discovery:
   - expected path mapping from known link jobs or deterministic destination plan
   - optional heuristic matching only when the expected destination file is absent
2. inode proof:
   - compare `st_dev` and `st_ino`
   - confirm regular file type
   - record `st_nlink` and size as supporting data

#### Architecture impact

- new verification service layer
- new verification report generator
- ability to verify:
  - by prior job
  - by source/destination set
  - by ad hoc path pair

#### Data model additions

- `verification_runs`
  - id
  - created_at
  - mode (`job`, `set_pair`, `manual`)
  - source_set
  - dest_set
  - dry_report
  - summary counts
- `verification_results`
  - verification_run_id
  - source_path
  - candidate_dest_path
  - source_dev
  - dest_dev
  - source_inode
  - dest_inode
  - source_nlink
  - dest_nlink
  - file_size
  - status
  - notes

#### API changes

- `POST /api/verify`
- `GET /api/verify/{run_id}`
- `GET /api/verify/{run_id}/export.json`
- `GET /api/verify/{run_id}/export.csv`

#### UI changes

- new `Verification` tab
- verification run form
- per-file results table
- filters:
  - failures only
  - unverified only
  - ambiguous only

#### Unraid caveats

- verification should explain when `/mnt/user` or separate mounts make proof or linkability unreliable
- reports should clearly distinguish:
  - not hardlinked
  - not linkable in current layout

### 2. Destination management inside the web app

#### Goal

Let users define and manage destination roots directly in the UI.

#### Core capability

- add destination
- edit destination
- disable destination
- delete destination
- tag destination by purpose
- browse allowed mounted paths
- validate safety before saving

#### Proposed implementation decision

Persist destinations in the application database, with optional export or import
from config later. Do not rely on free-form config editing as the primary operator path.

Use two layers:

- deployment-level allowlisted browse roots
- user-managed destinations stored in DB

#### Required guardrails

- path must exist
- path must be under an allowlisted root
- path must not be:
  - `/`
  - `/config`
  - `/data`
  - app internal directories
  - obvious system paths
- writable check for write-intended destinations
- compatibility warning when source and destination are not link-compatible

#### Architecture impact

- new path browsing and validation service
- new admin-safe allowlist configuration surface
- destination registry in DB

#### Data model additions

- `destination_roots`
  - id
  - label
  - path
  - tag
  - enabled
  - notes
  - created_at
  - updated_at
- `allowed_browse_roots`
  - id
  - path
  - read_only
  - created_at

#### API changes

- `GET /api/destinations`
- `POST /api/destinations`
- `PATCH /api/destinations/{id}`
- `DELETE /api/destinations/{id}`
- `POST /api/destinations/validate`
- `GET /api/fs/browse?path=...`

#### UI changes

- new `Destinations` tab
- editable destination table
- add/edit modal with validation results
- browse picker limited to allowed roots

#### Unraid caveats

- this feature is only useful if the container can see the relevant host paths
- broad mounts increase usefulness but increase risk
- browse and save must be constrained to operator-approved roots

### 3. Name, folder, and filename filtering during link creation

#### Goal

Allow optional cleanup and normalization of destination names during link planning.

#### Core capability

- keep raw source path untouched
- parse source names into structured candidate metadata
- generate proposed destination folder or file names
- allow user preview and manual override
- apply only to destination naming, not source mutation

#### Proposed implementation decision

Build a rule-based normalization pipeline first, with explicit stages and toggles.
Do not attempt metadata scraping or fuzzy online lookup in the first pass.

Pipeline shape:

1. tokenize raw name
2. classify tokens:
   - title candidate
   - year
   - season or episode
   - resolution
   - codec
   - source
   - edition
   - release group
3. construct parsed metadata object
4. generate proposed clean name
5. allow UI override

#### Rule categories

- replace dots or underscores with spaces
- collapse whitespace
- remove quality tokens
- remove codec tokens
- remove source tokens
- strip release group suffixes
- retain year
- retain season or episode
- preserve edition tags selectively
- optional title case

#### Architecture impact

- new normalization rules engine
- new parser result model
- new preview UI component in link planning

#### Data model additions

- `naming_profiles`
  - id
  - name
  - media_type
  - enabled_rules
  - created_at
  - updated_at
- `link_jobs`
  - raw_source_name
  - parsed_name_json
  - proposed_dest_name
  - approved_dest_name
  - naming_profile_id

#### API changes

- `POST /api/naming/preview`
- `GET /api/naming/profiles`
- `POST /api/naming/profiles`
- `PATCH /api/naming/profiles/{id}`

#### UI changes

- new `Naming Rules` tab
- side-by-side preview:
  - raw
  - proposed
  - final edited
- toggleable rules per profile

#### Caveats

- this must stay optional
- ambiguous titles must not be over-normalized silently
- anime and TV rules should be conservative in the first pass

### 4. Container and mount strategy for Unraid

#### Goal

Define a safe and reliable deployment model for Unraid that supports linking,
verification, and destination browsing.

#### Proposed implementation decision

Support two documented modes:

##### Safe mode

- narrow allowlisted mounts
- read-only for source paths where possible
- explicit destination roots
- intended for users who mainly want link execution and basic verification

##### Full mode

- broader disk-level visibility
- destination browsing and advanced verification across more paths
- intended for power users

#### Recommended mount rule

For real hardlink execution, prefer mounting a shared disk-level parent path
such as:

- `/mnt/disk3:/mnt/disk3`

and using config paths under that same mounted tree:

- source: `/mnt/disk3/moviesingress`
- dest: `/mnt/disk3/movies`

Do not assume separate source and destination bind mounts are safe for hardlinking,
even when they appear to reference the same physical disk.

#### Architecture impact

- deployment docs must distinguish:
  - execution-safe layout
  - browse-only layout
- validation logic should include mount-layout warnings, not just `st_dev` checks

#### API and UI impact

- destination validation should report:
  - same filesystem
  - same mount root
  - likely Unraid-safe or likely Unraid-risky
- job preview should include a mount-layout warning banner when relevant

#### Documentation requirements

- explain why `/mnt/user` can be misleading
- explain why disk-level mounts may be required
- explain safe mode vs full mode
- explain risks of broad mounts and write access

### 5. General UX and safety expectations

#### Core expectations

- preview first
- dry-run wherever possible
- explicit confirmation before writes
- full operation logging
- exportable reports
- auditability over silent automation

#### Required UI additions

- `Verification` tab
- `Destinations` tab
- `Naming Rules` tab
- richer job preview screen with:
  - source
  - destination
  - same-filesystem result
  - mount-layout result
  - proposed naming cleanup
  - final summary before apply

## Proposed architecture impacts

The current single-purpose engine becomes a broader operator workflow system with
four major service areas:

1. core linking engine
2. verification engine
3. destination registry and path safety service
4. naming normalization service

Recommended internal split:

- `engine/linking.py`
- `engine/verification.py`
- `engine/destinations.py`
- `engine/naming.py`
- `engine/fs_validation.py`

The web layer should remain thin and use structured service outputs rather than
reimplement logic.

## Proposed data model changes

Tables to add or extend:

- `destination_roots`
- `allowed_browse_roots`
- `verification_runs`
- `verification_results`
- `naming_profiles`
- extend `link_history` with:
  - `approved_dest_name`
  - `naming_profile_id`
  - `verification_run_id`

## Proposed API changes

### Verification

- `POST /api/verify`
- `GET /api/verify/{run_id}`
- `GET /api/verify/{run_id}/export.csv`
- `GET /api/verify/{run_id}/export.json`

### Destinations

- `GET /api/destinations`
- `POST /api/destinations`
- `PATCH /api/destinations/{id}`
- `DELETE /api/destinations/{id}`
- `POST /api/destinations/validate`
- `GET /api/fs/browse`

### Naming

- `POST /api/naming/preview`
- `GET /api/naming/profiles`
- `POST /api/naming/profiles`
- `PATCH /api/naming/profiles/{id}`

## Proposed UI changes

- add `Verification` tab
- add `Destinations` tab
- add `Naming Rules` tab
- extend preview step with:
  - mount-layout warnings
  - same-filesystem status
  - naming preview
- add export buttons for verification results

## Open design decisions with recommended answers

### 1. Best way to detect and verify hard links reliably on Unraid

Recommendation:
- use `st_dev` and `st_ino` as proof
- use expected path mapping or job history for candidate discovery
- treat filename matching only as fallback candidate generation
- surface mount-layout warnings separately from proof status

### 2. Best mount strategy for an Unraid Docker deployment

Recommendation:
- prefer shared disk-level parent mounts for execution
- document `/mnt/user` as browse-friendly but potentially unreliable for hardlink execution
- support safe mode and full mode

### 3. Should destination browsing be constrained to admin-approved roots

Recommendation:
- yes
- browsing should be limited to allowlisted roots only

### 4. Best persistence model for destinations and naming profiles

Recommendation:
- database as primary store
- optional export or import later if config portability becomes important

### 5. How to structure a rename and normalization rules engine

Recommendation:
- rule-based pipeline with ordered stages
- profiles by media type
- human preview and override always available

### 6. How to keep the app safe for normal users while useful for power users

Recommendation:
- safe mode defaults
- advanced mode as explicit opt-in
- broad mounts and high-power browse roots should be documented as advanced deployment

### 7. Whether to include per-job verification history and report export

Recommendation:
- yes
- this materially improves auditability and operator trust

## Phased implementation order

### Phase 1: hard link verification

Why first:
- highest operator value
- strongest trust-building feature
- lowest conceptual risk compared with path browsing or naming

Deliverables:
- verification engine
- verification tab
- verification reports
- export support

### Phase 2: destination management with safe path validation

Why second:
- reduces config friction
- improves usability for less-technical users
- introduces required safety controls for future browsing

Deliverables:
- destination registry
- browse-root allowlist
- validation API and UI

### Phase 3: naming cleanup preview pipeline

Why third:
- useful but less foundational than verification and destination safety
- easier to keep optional once preview infrastructure exists

Deliverables:
- naming profiles
- preview engine
- UI override controls

### Phase 4: advanced Unraid mount strategy and power-user features

Why fourth:
- depends on real deployment experience
- should be documented only after the safer defaults are established

Deliverables:
- safe mode docs
- full mode docs
- mount-layout warnings
- advanced browse and verification workflows

## Suggested next task slicing

Future agent runs should be broken into narrow slices such as:

1. verification data model and backend
2. verification UI and export
3. destination registry and validation backend
4. destination management UI
5. naming profile data model and parser skeleton
6. naming preview UI
7. Unraid deployment doc update and mode split

## Provenance

- Date: 2026-04-16
- Basis: user-provided feature requests, current app shape, and real Unraid validation findings
- Confidence: high
