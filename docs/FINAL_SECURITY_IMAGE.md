# Final security image

The operator authorized one final image release under DEC-013. The project remains deprecated and unmaintained.

Release preparation uses version 1.0.7 and the existing Docker Hub repository, starlightdaemon/hardlink-organizer. Target platform is Linux/amd64, matching the existing published image.

The manual final-security-image workflow builds once from fresh bases, verifies the actual candidate application as a nonroot user, exercises HTTP and filesystem behavior, audits installed Python packages, and scans OS/language packages with Trivy. Fixable high/critical image findings block publication. All scanner findings, including unfixed issues, are retained in the workflow evidence.

After publishing the versioned image, verification pulls it by immutable digest and repeats the smoke checks. Only then is the same image promoted to latest. Ordinary automatic publishing remains disabled.

Publication evidence, digest, and runtime results will be recorded here after verification. The final administration step is to disable the one-off workflow and archive the repository again.
