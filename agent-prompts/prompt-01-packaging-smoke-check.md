# Prompt 01: Packaging Smoke Check

Review the Unraid Docker packaging for Hardlink Organizer and do only a packaging smoke-validation pass.

Repository root:
`/mnt/e/HardlinkOrganizer`

Read first:
1. `packaging/unraid/README.md`
2. `packaging/unraid/docker/Dockerfile`
3. `packaging/unraid/docker/docker-compose.yml`
4. `./README.md`

Task:
Verify that the documented Docker workflow is internally consistent and correct any remaining packaging or documentation mismatches.

Scope:
- Dockerfile paths
- compose build and run flow
- README commands
- host mount documentation

Do not:
- modify engine logic
- change the web UI
- add new features

Validation:
- explain exactly how the user is expected to build and start the container
- state any remaining assumptions clearly

Final response:
- list changed files
- summarize the corrected packaging flow
- call out any residual risks
