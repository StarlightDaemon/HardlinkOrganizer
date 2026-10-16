# v1.0.8 — Final security image (deprecated)

Published on 2026-10-16 to [Docker Hub](https://hub.docker.com/r/starlightdaemon/hardlink-organizer/tags?name=v1.0.8). The project remains deprecated and unmaintained under DEC-011. DEC-013 authorized this final image publication.

## Image identity

- Versioned image: `starlightdaemon/hardlink-organizer:v1.0.8`
- Alias: `starlightdaemon/hardlink-organizer:latest`
- Platform: `linux/amd64`, matching the existing published platform
- Both tags resolve to `sha256:6d091e09bb074d7a822aab4ec689bcdfea8343de8c481dc30b800f5aa524e660`.
- Built source / OCI revision: `6dc0bb5f5bb50a270e2739b1a66f109fcfe4340b`
- [Successful build, publication, and remote verification](https://github.com/StarlightDaemon/HardlinkOrganizer/actions/runs/38942322273)
- [Final GitHub release and downloadable verification evidence](https://github.com/StarlightDaemon/HardlinkOrganizer/releases/tag/v1.0.8)

Pull the fixed image and recreate existing containers using the same configuration and storage mounts:

```bash
docker pull starlightdaemon/hardlink-organizer:v1.0.8
```

For an immutable deployment reference:

```text
starlightdaemon/hardlink-organizer@sha256:6d091e09bb074d7a822aab4ec689bcdfea8343de8c481dc30b800f5aa524e660
```

All six compose/stack examples and the Unraid/TrueNAS image references now select v1.0.8. The earlier v1.0.7 image is preserved; v1.0.8 includes the additional Debian security update and is the final recommended image.

## Included fixes and hardening

- Destination hardlink operations reject nested symlinks/reparse points. Linux uses descriptor-relative, no-follow traversal and link creation so parent symlink swaps do not redirect writes.
- Frontend source-map-js is patched to 1.2.2.
- Build-time Python packaging tools are pinned to patched versions. Unused pip, setuptools, wheel, and ensurepip are removed from the final runtime image, including their bundled dependency copies.
- Fresh base images are pulled without build cache, and available Debian package upgrades are installed, including the liblzma5 update.
- Nested node_modules and Python caches are excluded from the build context. No frontend development dependency directory is shipped.
- The built candidate is published without rebuilding after verification.

## Verification

| Check | Result |
| --- | --- |
| Full Python suite inside the candidate, as nonroot | 270 passed |
| Frontend test and npm audit | Passed; 0 reported vulnerabilities |
| Production frontend build | Passed during image build |
| Candidate installed Python package audit | No known vulnerabilities |
| Trivy 0.76.0 Python / Node package findings | 0 / 0 |
| Trivy findings with an available fix, any severity | 0 |
| Trivy critical findings | 0 |
| Default and custom UID/GID, checked against PID 1 | Passed |
| HTTP health, configuration, SQLite, SPA and assets | Passed |
| Scan, preview, dry run, real hardlink, collision handling | Passed |
| Source preservation and destination symlink refusal | Passed |
| Remote pull by digest and repeated runtime checks | Passed |
| Docker Hub version and latest manifest digests | Match |
| Publishing / verification workflows | Disabled after successful verification |

Tests mount only the test files and separate read-only test tools; application code and runtime dependencies come from the image. The Python audit inventories the original candidate environment and runs the auditor outside the image. Runtime smoke uses disposable configuration/media fixtures.

## Remaining OS advisories

The image is **not vulnerability-free**. Trivy reports these Debian package findings with no fixed version listed:

| Severity | Package findings | Distinct advisory IDs within severity |
| --- | ---: | ---: |
| Critical | 0 | 0 |
| High | 44 | 8 |
| Medium | 58 | 29 |
| Low | 61 | 33 |
| Unknown | 1 | 1 |

High findings have affected/fix-deferred statuses; medium findings have the same status categories. These are scanner package matches, not a determination that each issue is reachable or exploitable in this deployment. No finding was suppressed. The full Trivy JSON, package inventory, image metadata, and test/smoke logs are attached to the GitHub release.

Keep this unauthenticated application on trusted networks. Existing installations require an image pull and container recreation; publishing an image does not update running installations. The runtime no longer contains package installation tools, so dependency changes require rebuilding the image.

The final administration step is repository re-archiving after the release evidence is published. GitHub's archived property is the authoritative remote read-only state. No ongoing maintenance or future update commitment is implied.
