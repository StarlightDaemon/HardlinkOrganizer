# Closure Report — M-1 + L-1 + L-3

**Date:** 2026-06-01
**Commit:** 985b3be
**Tests:** 191 passed, 0 failed

## M-1 — HARDLINK_CONFIG env var
Files changed:
- webapp/run.py : added `import os`; changed `--config` from `required=True` to
  `default=os.environ.get("HARDLINK_CONFIG")`; added post-parse guard that calls
  `parser.error(...)` with a clear message if `args.config` is None.

## L-1 — jinja2 removed
Files changed:
- requirements.txt : removed `jinja2>=3.1.0` line (grep confirmed zero imports
  anywhere in the codebase; leftover from pre-React Jinja2 template era)

## L-3 — /tmp added to unsafe roots
Files changed:
- webapp/app.py : added `/tmp` and `/var/tmp` to `_UNSAFE_DEST_ROOTS` frozenset

## Open follow-ups
- Subdirectory protection (e.g. `/tmp/foo`) is intentionally out of scope; the
  frozenset guard covers exact root matches only. No action needed for v1.0.
