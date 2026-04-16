# Community Apps Roadmap

This roadmap describes the path from the current local beta state of Hardlink Organizer
to a fully submitted Unraid Community Apps package. It is intentionally staged so work
can be executed one step at a time and expanded into narrower loops later.

## Goal

Submit Hardlink Organizer to Unraid Community Apps with:

- a pullable Docker image
- a valid CA template repository
- a real support thread
- validated Unraid behavior on a real host
- current documentation that matches the published artifact

## Current baseline

- App code exists and passes local non-web verification.
- Unraid packaging assets exist under `packaging/unraid/`.
- GitHub Actions workflow exists for GHCR image publishing.
- Draft CA template, maintainer profile, icon, and support-thread content exist.
- Real Unraid host validation is still required.
- Public GitHub publication and CA submission are still pending.

## Staged path

### Stage 1: freeze the release candidate surface

Purpose:
- stop naming churn and packaging drift before external publication

Exit criteria:
- canonical project name, image name, paths, and docs are stable
- local verification passes on the renamed project layout
- known release risks are explicitly listed

Notes:
- this stage is mostly complete

### Stage 2: complete real Unraid host validation

Purpose:
- prove the Docker/web workflow works on an actual Unraid system, not just locally

Key checks:
- container boots on Unraid with mounted config and data paths
- web UI is reachable
- source and destination mounts behave as expected
- same-device validation blocks invalid links
- real same-device hardlinks are created successfully
- collisions skip safely
- logs and SQLite state persist across restart

Exit criteria:
- `packaging/unraid/VALIDATION_CHECKLIST.md` is executed on a real host
- results are captured and any defects are fixed

Execution detail:
- use `notes/CA_STEP_01_UNRAID_VALIDATION_PLAN.md`

### Stage 3: publish the Docker image to GHCR

Purpose:
- produce a stable public image for template consumers

Key checks:
- repository pushed to GitHub
- GitHub Actions workflow runs successfully
- GHCR package is visible and pullable
- version tags publish versioned images and `latest` behavior is understood

Exit criteria:
- a public image such as `ghcr.io/<owner>/hardlink-organizer:<version>` exists
- image name in docs and template matches the actual published package

### Stage 4: harden the Unraid template for CA

Purpose:
- ensure the CA XML is valid, minimal, and aligned to real runtime behavior

Key checks:
- `Repository`, `Project`, `Support`, `Icon`, `Overview`, `Category`, and `WebUI` are correct
- container paths and defaults match the published container
- no placeholder URLs remain
- wording reflects the current product name and workflow

Important source guidance:
- Unraid forum guidance indicates CA expects the supported XML shape and requires
  at least `Description` or `Overview`
- current forum guidance also indicates templates need usable `Project` or `Support`
  entries to remain listed

Exit criteria:
- template reviewed against current runtime behavior
- no placeholder support or image references remain

### Stage 5: create the dedicated CA template repository

Purpose:
- separate the CA template assets from the main application repository

Expected contents:
- `hardlink-organizer.xml`
- `ca_profile.xml`
- hosted icon asset or stable icon URL reference

Key checks:
- repository is public
- default branch is `main` or `master`
- raw GitHub URLs used in the template resolve correctly

Exit criteria:
- dedicated template repository exists and serves the final template assets

### Stage 6: publish the support thread

Purpose:
- provide the required user-facing support location for CA and future operators

Key checks:
- post uses the current product name and GHCR image name
- support expectations and issue-reporting path are clear
- final forum URL is inserted into the XML

Exit criteria:
- real Unraid forum support thread exists
- CA template `Support` field points to it

### Stage 7: submit to Community Apps

Purpose:
- formally hand the template repository to the CA review pipeline

Key checks:
- submission form uses the correct template repository
- maintainer details are present
- category and support metadata are included

Exit criteria:
- CA submission is sent
- submission details and date are captured in the ledger

### Stage 8: handle post-submission follow-up

Purpose:
- close review feedback and move from submitted to accepted

Key checks:
- respond to CA feedback quickly
- update XML or docs if requested
- verify CA indexing after approval

Exit criteria:
- template appears in Community Apps
- installation path is verified from CA on a real Unraid host

## Recommended execution order

1. Finish real Unraid validation.
2. Push repo and publish GHCR image.
3. Finalize CA XML against the published image and real support URL.
4. Create dedicated template repo.
5. Post support thread.
6. Submit to CA.
7. Track review and acceptance.

## Decomposition plan

Each future execution slice should map to one of these focused work packages:

1. `CA-STEP-01`: real-host validation run and defect capture
2. `CA-STEP-02`: GitHub/GHCR publication and tag verification
3. `CA-STEP-03`: XML/template hardening pass
4. `CA-STEP-04`: dedicated template repository setup
5. `CA-STEP-05`: support thread publication
6. `CA-STEP-06`: CA submission packet and form submission
7. `CA-STEP-07`: post-submission follow-up and acceptance verification

## External references

- Unraid Docker FAQ / Community Apps workflow:
  https://forums.unraid.net/topic/57181-docker-faq/
- Unraid Docker Template XML schema and CA-specific guidance:
  https://forums.unraid.net/topic/38619-docker-template-xml-schema/

## Provenance

- Date: 2026-04-15
- Basis: current repository state plus existing packaging assets and current Unraid forum guidance
- Confidence: medium-high
