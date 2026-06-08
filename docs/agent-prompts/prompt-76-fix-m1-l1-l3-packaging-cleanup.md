# Prompt 76: Fix M-1 + L-1 + L-3 — Packaging & Infra Cleanup

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning off (no operator questions needed — all changes are mechanical)

---

## Context

This loop closes three findings from `docs/v1-release-readiness-report.md`:

- **M-1** (Medium) — `HARDLINK_CONFIG` env var is set in Dockerfile but never read
- **L-1** (Low) — `jinja2` is listed in `requirements.txt` but never imported
- **L-3** (Low) — `/tmp` is not in `_UNSAFE_DEST_ROOTS`; destinations under `/tmp` are accepted silently

All three fixes are mechanical. No operator questions are needed. Implement all
three, verify tests pass, write the closure report, and print the copy-paste excerpt.

Previous completed loops: C-1, C-2, R-1–R-3, H-1, H-2, M-2. All 185+ tests pass on `main`.

---

## Repository root

`/Users/dante/Citadel/HardlinkOrganizer`

---

## M-1 — HARDLINK_CONFIG env var is a dead letter

### Location

`packaging/docker/Dockerfile:48` · `webapp/run.py`

### What goes wrong

The Dockerfile sets:

```dockerfile
ENV HARDLINK_CONFIG=/config/config.toml
```

But `webapp/run.py` reads only `args.config` (the `--config` CLI flag). The
`HARDLINK_CONFIG` environment variable is never consulted. CMD hardcodes
`--config /config/config.toml` so the default works — but any operator who
sets `HARDLINK_CONFIG` in a `docker-compose.yml` environment block gets no
effect, with no error or warning.

### Fix

In `webapp/run.py`, read `HARDLINK_CONFIG` as the default for `--config` when
the argument is not explicitly passed:

```python
import os

parser.add_argument(
    "--config", "-c",
    default=os.environ.get("HARDLINK_CONFIG"),
    metavar="PATH",
    help="Path to the TOML configuration file (default: $HARDLINK_CONFIG).",
)
```

Also change `required=True` to check: if neither `--config` nor `HARDLINK_CONFIG`
is provided, print a clear error and exit rather than Argparse's default
"required argument missing" message. Simplest approach:

```python
args = parser.parse_args(argv)
if not args.config:
    parser.error("--config PATH is required (or set HARDLINK_CONFIG env var)")
```

---

## L-1 — jinja2 is an unused dependency

### Location

`requirements.txt:6`

### What goes wrong

`jinja2>=3.1.0` is listed in `requirements.txt` but there are zero imports of
`jinja2` or `Jinja2` anywhere in the codebase. It is a leftover from the pre-React
era when templates were server-rendered. Jinja2 has had SSTI CVEs; keeping it
installed unnecessarily expands the attack surface and triggers vulnerability
scanners.

### Fix

Remove the `jinja2>=3.1.0` line from `requirements.txt`. Verify by grepping the
codebase for any remaining import before removing:

```bash
grep -r "jinja2\|from jinja\|import jinja" --include="*.py" .
```

If the grep is clean, delete the line.

---

## L-3 — /tmp is not in _UNSAFE_DEST_ROOTS

### Location

`webapp/app.py:72`

### What goes wrong

```python
_UNSAFE_DEST_ROOTS = frozenset({
    "/",
    "/bin", "/boot", "/config", "/data", "/dev",
    "/etc", "/lib", "/lib64", "/proc", "/root",
    "/run", "/sbin", "/sys", "/usr", "/var",
})
```

`/tmp` and `/var/tmp` are absent. A misconfigured or curious operator who
sets a destination path of `/tmp/my-links` passes validation with no warning.
Hardlinks written to `/tmp` are lost on reboot or when the tmpfs is cleared.
`/var/tmp` survives reboots on most Linux systems but is still generally
inappropriate as a managed hardlink destination.

### Fix

Add `/tmp` and `/var/tmp` to `_UNSAFE_DEST_ROOTS`:

```python
_UNSAFE_DEST_ROOTS = frozenset({
    "/",
    "/bin", "/boot", "/config", "/data", "/dev",
    "/etc", "/lib", "/lib64", "/proc", "/root",
    "/run", "/sbin", "/sys", "/tmp", "/usr", "/var", "/var/tmp",
})
```

Note: `/var` is already in the set, and `/var/tmp` is a subdirectory of `/var`.
The path check in `_validate_dest_path` uses `os.path.normpath` and exact
membership in the frozenset — it does NOT check parent paths. So `/var/tmp`
must be listed explicitly for the guard to fire on that exact path. Paths
*under* `/var/tmp` (e.g., `/var/tmp/foo`) pass the current check regardless.
The fix covers the root itself; subdirectory protection is out of scope.

---

## Files to read before starting

1. `webapp/run.py` — full file; find `--config` argument and `required=True`
2. `requirements.txt` — full file
3. `webapp/app.py:68–100` — `_UNSAFE_DEST_ROOTS` definition and
   `_validate_dest_path` function
4. `tests/test_webapp.py` — grep for `unsafe` or `_UNSAFE` to understand
   existing coverage of the dest path validation

---

## Acceptance criteria

- [ ] Setting `HARDLINK_CONFIG=/custom/path.toml` in the environment causes
      `webapp/run.py` to use that path when `--config` is not passed
- [ ] Passing `--config path.toml` explicitly still overrides `HARDLINK_CONFIG`
- [ ] `python webapp/run.py` with neither flag nor env var prints a clear error
- [ ] `jinja2` is absent from `requirements.txt` and the grep confirms zero imports
- [ ] `_validate_dest_path("/tmp")` returns `is_unsafe_root: true`
- [ ] `_validate_dest_path("/var/tmp")` returns `is_unsafe_root: true`
- [ ] All existing tests pass

---

## Closure report

Write a closure report to `.raiden/writ/CLOSURE_M1_L1_L3.md`:

```markdown
# Closure Report — M-1 + L-1 + L-3

**Date:** <date>
**Commit:** <hash>
**Tests:** <N> passed, 0 failed

## M-1 — HARDLINK_CONFIG env var
Files changed:
- webapp/run.py : <what changed>

## L-1 — jinja2 removed
Files changed:
- requirements.txt : removed jinja2 line

## L-3 — /tmp added to unsafe roots
Files changed:
- webapp/app.py : added /tmp and /var/tmp to _UNSAFE_DEST_ROOTS

## Open follow-ups
<any notes, or "none">
```

---

## Copy-paste excerpt for prime agent

Print this block after writing the closure report:

```
**[M-1 + L-1 + L-3] closed — commit `<hash>`**

| Fix | File | Change |
|---|---|---|
| M-1 | webapp/run.py | --config default reads HARDLINK_CONFIG env var |
| L-1 | requirements.txt | removed jinja2>=3.1.0 |
| L-3 | webapp/app.py | added /tmp and /var/tmp to _UNSAFE_DEST_ROOTS |

Tests: <N> passed, 0 failed.
```
