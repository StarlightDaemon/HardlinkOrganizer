# Prompt 10: 0.2.1 Release Hardening Pass

Do a bounded `0.2.1` release-hardening pass for Hardlink Organizer.

Repository root:
`/mnt/e/HardlinkOrganizer`

Read first:
1. `./README.md`
2. `./VERSION`
3. `./requirements.txt`
4. `packaging/unraid/README.md`
5. `packaging/unraid/VALIDATION_CHECKLIST.md`
6. `packaging/unraid/docker/Dockerfile`
7. `packaging/unraid/docker/docker-compose.yml`
8. `./tests/test_webapp.py`
9. `./webapp/run.py`

Task:
Stabilize and verify the current `0.2.0` web-app alpha into a cleaner `0.2.1` release-hardening checkpoint.

Primary goal:
Do the practical verification and cleanup work that sits between “feature landed” and “safe to hand to a real operator.” This is not a new feature pass.

Scope:
- dependency verification
- test-environment verification
- packaging/runtime consistency
- documentation consistency
- local smoke validation where practical
- version bump from `0.2.0` to `0.2.1` if the pass completes cleanly

What to do:
1. Verify the declared dependencies match actual runtime and test imports.
2. Run the web test suite and the broader project test suite if dependencies are available.
3. Do a local smoke check of the web app launch path if practical.
4. Review the Docker packaging flow end-to-end for internal consistency.
5. Review README, packaging README, and validation checklist for drift or contradictions.
6. Fix small issues you find if they are clearly within release-hardening scope.
7. If the pass is clean, update version markers from `0.2.0` to `0.2.1`.

Acceptable code changes in this pass:
- small packaging fixes
- small docs fixes
- small test fixes
- small startup-path or dependency fixes
- small version-marker updates

Do not:
- add new product features
- redesign the UI
- broaden into roadmap work
- introduce a database migration or schema redesign unless required for a clear bug
- start plugin packaging
- start a major refactor

Verification expectations:
- run the relevant tests and report exact commands
- if a required dependency is missing, install only what is necessary for this pass
- if local web launch is possible, verify the startup path and report what you observed
- if Docker build cannot be run locally, explain exactly what remains unverified

Preferred outcomes:
- docs and packaging all tell the same story
- test commands are reproducible
- runtime dependencies are minimal and correct
- validation checklist matches the actual `0.2.x` packaging flow
- version markers are explicit and coherent

Possible files to change:
- `./README.md`
- `./requirements.txt`
- `./VERSION`
- `./hardlink_organizer.py`
- `packaging/unraid/README.md`
- `packaging/unraid/VALIDATION_CHECKLIST.md`
- `packaging/unraid/docker/Dockerfile`
- `packaging/unraid/docker/docker-compose.yml`
- tests or small runtime glue if needed

Modeling constraints:
- keep changes bounded to release hardening
- prefer fixing the smallest thing that makes the docs/tests/runtime more coherent
- if you find larger architectural issues, document them but do not expand scope to solve them here

Final response requirements:
- list changed files
- list tests and verification commands run
- state whether you recommend bumping to `0.2.1`
- summarize remaining risks that still require real Unraid host validation
