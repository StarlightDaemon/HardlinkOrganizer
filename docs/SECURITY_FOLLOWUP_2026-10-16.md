# Security follow-up — 2026-10-16

## Scope

The operator authorized a bounded security follow-up and re-archiving. The project remains deprecated under DEC-011; DEC-012 records this exception. Work started from the published main commit 62c9682, using a clean managed worktree to preserve the original checkout's local commits and package edits.

GitHub initially showed no open Dependabot alerts after unarchiving. Independent audits still found a vulnerable npm dependency, so alert absence was not treated as proof that dependencies were safe. No critical dependency finding was reported by the current audits.

## Fixes

| Finding | Change |
| --- | --- |
| High: source-map-js denial of service, GHSA-68fv-2mgg-jv7q / CVE-2026-93749 | Updated the compatible transitive dependency from 1.2.1 to 1.2.2 in the frontend lockfile; no frontend package major upgrades |
| Medium: setuptools MANIFEST.in exclusion bypass, PYSEC-2026-3447 / CVE-2026-59890 | Pin setuptools 83.0.0 so Python 3.11 installs and container rebuilds replace vulnerable bundled versions |
| Medium: nested destination directory symlinks redirect hardlink writes outside the selected destination | Refuse destination symlinks/reparse points and use no-follow, descriptor-relative destination directory traversal and link creation on Linux |

The dependency advisory identifies 1.2.2 as the patched version: [GitHub advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

The initial Linux audit detected setuptools 79.0.1 inherited from the Python 3.11 toolchain. The declared requirements now replace it with 83.0.0. This fixes the packaging-tool advisory; the application does not build source distributions. See the [upstream advisory](https://github.com/pypa/setuptools/security/advisories/GHSA-h35f-9h28-mq5c) and [Python advisory database](https://github.com/pypa/advisory-database/blob/main/vulns/setuptools/PYSEC-2026-3447.yaml).

The filesystem fix covers ordinary execution and dry runs. Linux keeps the final destination directory descriptor open while linking, so replacing a parent pathname with a symlink cannot redirect the write. Directory creation also opens the resulting directory with no-follow flags, including when another process creates a path first. Linux O_PATH descriptors preserve access through ancestors that permit search but not directory reading. Existing collision handling still uses atomic os.link and never overwrites a destination.

Seven focused tests cover six security regressions plus the traverse-only permission compatibility case. The security-verification workflow compares these tests against the pre-fix engine and then runs the complete fixed suite on Linux/Python 3.11.

## Verification

Pending: record the completed Linux verification run here before re-archiving.

Local checks completed:

- npm audit: zero vulnerabilities after the lockfile update.
- npm ci, production frontend build, and frontend test: passed.
- pip-audit 2.10.1 against a freshly resolved environment containing the declared Python dependencies, including patched setuptools 83.0.0: no known vulnerabilities. The initial Linux run identified the toolchain issue before the remaining checks; verification is rerun after fixing it.
- Supported Windows engine subset: 79 passed, 2 skipped, 14 deselected before the final permission-only refinement.
- Full Windows run: 241 passed, 16 skipped, 12 failed; these failures concern Linux mount-path assumptions and missing Windows symlink privilege. The production-platform verification is the Linux workflow.
- Independent static review checked descriptor lifetime, no-overwrite behavior, and test validity; its directory-permission and regression-hook findings were incorporated.
- Staged-change secret scan: passed. A broader directory scan produced 200 generic-key matches, all in the untracked pip-audit dependency license_expression/data/scancode-licensedb-index.json; these are license identifiers rather than repository credentials.

## Limits and deployment impact

Destination directory symlinks are now refused even when they point inside a library; configure real directory paths. Windows rejects existing symlinks/junctions before and after directory creation, but the descriptor-based race protection is Linux-specific. The software remains intended for trusted networks and still has no authentication.

This follow-up verifies the source repository, its currently resolved dependencies, and the confirmed filesystem defect. It does not claim an exhaustive application penetration test, a container-image vulnerability scan, or protection against all hostile filesystem changes. No existing container image, release tag, or deployment was replaced; users of distributed images must rebuild from the fixed source to receive the filesystem change.

Image publishing remains disabled. After successful verification and publication of this report, disable the manual verification workflow and archive again. GitHub's archived property is the authority for the remote read-only state.
