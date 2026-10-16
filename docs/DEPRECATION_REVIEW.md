# Deprecation and credential review — 2026-10-15

## Outcome

No critical credential issue or exposed secret was identified in the reviewed material. The README now announces that the project is deprecated, supplied as-is, and receives no planned development, maintenance, or security fixes. A future revival remains possible without any commitment to updates.

DEC-011 records the retirement decision. Outstanding platform-submission loops are cancelled, and previous goals are retained as history. GitHub archiving is performed after publishing this report; the repository's live archived property is the authority for its read-only status.

## Scope and evidence

The published baseline was origin/main at f7662eb9f4f939b90a9ba6ff661f909849f62b6b. The review also included the original local checkout at 9fe9b95, its existing uncommitted package edits, local untracked material, and all locally available refs after fetching origin branches and tags.

| Check | Result |
| --- | --- |
| Gitleaks version | 8.30.1 |
| Working-directory scan | No leaks; approximately 11.70 MB scanned |
| All-ref history scan | No leaks; 100 commits scanned, approximately 1.59 MB |
| Reachable history | 101 commits including merge history |
| Manual credential-keyword review | No credential values identified |
| Historical sensitive-filename review | No matching credential, private-key, environment, or database paths |
| GitHub secret-scanning alerts | 0 total; secret scanning and push protection enabled |
| GitHub Dependabot alerts | 0 open, including 0 critical; 14 historical alerts |

Scanner invocations:

~~~text
gitleaks dir . --redact=100 --ignore-gitleaks-allow --max-archive-depth=3 --no-banner --no-color
gitleaks git . --log-opts="--all --full-history" --redact=100 --ignore-gitleaks-allow --no-banner --no-color
~~~

Both scans exited successfully with no leaks. Suppression comments were ignored, and scanner output used full redaction. The directory scan included local material beyond tracked source; the history scan covered fetched branches and release tags as well as local refs. No repository-level Gitleaks configuration or ignore file was present to suppress findings.

Manual review covered API keys, tokens, passwords, client secrets, private keys, credential-bearing configuration names, CI, Docker packaging, examples, tests, and project documentation. The keyword matches were benign: GitHub Actions secret references, a TrueNAS password input field, design-system tokens, and test or audit prose. No secret values are reproduced here.

## Findings and remaining considerations

1. **No critical exposed-credential finding.** No evidence from this review requires credential rotation or history rewriting.
2. **Existing deployment risk: unauthenticated network access.** README.md already documents that the app has no authentication. webapp/run.py defaults to 0.0.0.0:7700, and Docker publishes the service. Its API can execute filesystem operations within its configured access. Keep existing instances restricted to trusted networks or an authenticated access layer. This review did not establish that any deployment is publicly exposed.
3. **Stored CI credentials remain outside Git.** GitHub Actions contains DOCKERHUB_TOKEN and DOCKERHUB_USERNAME. These are stored-secret names, not exposed values, and their values were not retrieved. Review or revoke the Docker Hub token at its provider if it is no longer needed, accounting for any other repositories that share it. No stored secret was deleted or rotated.
4. **Archive scope.** Archiving the source repository does not shut down installed instances, remove published container images, or revoke credentials. Existing deployments and distributed images retain their current behavior.

## Limits and completion checks

This is a repository credential review, not an exhaustive application penetration test or a new dependency/container audit. Pattern-based scanning can miss custom, encrypted, or otherwise unrecognized secrets. Coverage is limited to the working material and reachable history available after fetching; unreachable/deleted remote objects, other repositories, CI logs and artifacts, external registries, deployed configurations, and credentials stored by providers were not inspected.

No runtime code or dependencies were changed. Documentation and whitespace checks, repeat secret scans, and GitHub read-back verification are the relevant validation. Application tests were not rerun.

The final administration sequence disables the image-publishing workflow before the documentation push, updates the GitHub description to indicate deprecation, and archives the repository. Completion is verified against GitHub after publication. The original checkout's local commits and existing package changes are preserved.
