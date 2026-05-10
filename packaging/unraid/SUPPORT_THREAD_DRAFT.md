# Support Thread Draft

## [Support] Hardlink Organizer

Hardlink Organizer is a hosted web UI plus CLI fallback for scanning ingress or download folders and creating hardlinks into destination library roots without moving or renaming the source payload.

### Current status

- Version: `1.0.0-rc.1`
- Status: release candidate
- Platform: Unraid
- Delivery: Docker-hosted web UI with CLI fallback

### Key capabilities

- scan configured source sets
- browse inventory in the web UI
- preview destination mapping before execution
- validate same-device hardlink compatibility at runtime
- hardlink files or full directory trees
- skip collisions by default
- preserve the source tree
- store scan and link history in SQLite

### Known constraints

- hardlinks only work on the same underlying device
- Unraid `/mnt/user` behavior can hide device placement, so validation is runtime-based
- real-host validation is still required for cache-vs-array and SHFS edge cases

### Project links

- GitHub project: `https://github.com/StarlightDaemon/HardlinkOrganizer`
- Docker image: `ghcr.io/starlightdaemon/hardlink-organizer`

### Support expectations

If reporting a problem, include:

- Unraid version
- exact image tag in use
- whether the failure happened in preview or execute
- container logs
- relevant config path mappings
- whether the source and destination were on the same pool or disk

### Current publish note

This draft should be posted as a real Unraid forum support thread before Community Apps submission, then the template `Support` URL should be updated to the final thread URL.
