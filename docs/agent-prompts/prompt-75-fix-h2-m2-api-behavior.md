# Prompt 75: Fix H-2 + M-2 — API Behavior Corrections

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning on

---

## Context

This loop closes two findings from `docs/v1-release-readiness-report.md`:

- **H-2** (High) — Empty `dest_subpath` in execute silently falls back to a generated name
- **M-2** (Medium) — PATCH `/api/destinations` cannot clear optional fields once set

Previous completed loops: C-1, C-2, R-1–R-3, H-1. All 185 tests pass on `main`.

Your job:
1. Ask the operator the questions below using the `AskUserQuestion` tool (interactive prompts)
2. Implement both fixes
3. Write a closure report to `.raiden/writ/CLOSURE_H2_M2.md`
4. Print the copy-paste excerpt block (defined at the bottom of this prompt) for the operator to relay to the prime agent

---

## Repository root

`E:\Citadel/HardlinkOrganizer`

---

## H-2 — Empty dest_subpath silently falls back to generated name

### Location

`webapp/models.py:112` · `webapp/app.py:395`

### What goes wrong

`ExecuteRequest.dest_subpath` is typed as required `str`:

```python
# webapp/models.py
class ExecuteRequest(BaseModel):
    source_set: str
    full_path: str
    dest_set: str
    dest_subpath: str      # required, non-optional
    dry_run: bool = False
```

`PreviewRequest` declares the same field as optional:

```python
class PreviewRequest(BaseModel):
    ...
    dest_subpath: str | None = None    # optional
```

In `build_link_plan` (`hardlink_organizer.py`), the guard:

```python
if not dest_subpath:
    dest_subpath = suggest_destination_name(entry["display_name"])
```

fires on any falsy value — including an empty string `""`. So a client
sending `dest_subpath: ""` passes Pydantic validation (it is a valid `str`),
but silently lands at a different path than the one the user reviewed in the
preview step. The execute response records the substituted path in history with
no indication the substitution occurred.

### Fix options

**Option A — Make dest_subpath Optional[str] = None in ExecuteRequest**

```python
class ExecuteRequest(BaseModel):
    ...
    dest_subpath: str | None = None
```

Clients can now omit `dest_subpath` or send `null` to request a generated name.
The execute route applies the same `or suggest_destination_name(...)` guard
explicitly and visibly. Matches `PreviewRequest` shape.

**Option B — Keep required str, reject empty string with a Pydantic validator**

```python
from pydantic import field_validator

class ExecuteRequest(BaseModel):
    ...
    dest_subpath: str

    @field_validator("dest_subpath")
    @classmethod
    def dest_subpath_nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("dest_subpath must not be empty")
        return v
```

Empty string returns 422 Unprocessable Entity. The client must always provide
an explicit non-empty path. No silent fallback.

---

## M-2 — PATCH /api/destinations cannot clear optional fields once set

### Location

`webapp/app.py:673`

### What goes wrong

```python
patch: dict = {k: v for k, v in body.model_dump().items() if v is not None}
```

This filter strips out any `None` value. Two consequences:

1. **Cannot clear a field once set.** Sending `{"tag": null}` is ignored — `tag`
   remains unchanged. There is no way to clear `tag` or `notes` via the API.

2. **Cannot set `enabled: false`.** `False` is not `None`, but Pydantic's
   `model_dump()` with no arguments includes unset optional fields as `None`.
   `enabled` is `bool`, not `bool | None`, but the same pattern silently
   discards any field that was not provided (because they default to `None`
   in `DestinationUpdate`). In practice: if a client sends `{"enabled": false}`,
   this arrives correctly — but if a client sends `{"tag": null}` to clear the
   tag, it is filtered out.

The fix is to use Pydantic's built-in mechanism for distinguishing
"field not provided" from "field explicitly set to null":

```python
# webapp/app.py:673 — after fix
patch: dict = body.model_dump(exclude_unset=True)
patch["updated_at"] = now
```

`exclude_unset=True` includes only fields the client actually sent. An
explicitly-sent `null` arrives as `None` in the dict and is passed through
to the DB update, clearing the column. An omitted field is excluded entirely,
leaving the column unchanged.

---

## Questions for the operator

Use the `AskUserQuestion` tool to ask these before writing any code.

### H-2 questions

**Q1 — dest_subpath behavior:**
Should `dest_subpath` in `ExecuteRequest` be made optional (`str | None = None`),
allowing clients to omit it and receive a generated name (Option A)?
Or should it remain required and reject empty strings with a 422 (Option B)?

Note: if Option A is chosen, the execute route must apply the
`or suggest_destination_name(entry["display_name"])` guard explicitly so the
substitution is visible in code (not buried in `build_link_plan`).

**Q2 — Frontend impact:**
The React frontend (`PreviewStep.tsx`) currently sends
`dest_subpath: preview.dest_subpath` where `preview.dest_subpath` is always
a non-empty string (set during the preview step). The frontend change needed
depends on the option chosen:
- Option A: no change needed (current string value is always non-empty)
- Option B: no change needed (current string value is always non-empty)

Either way, the frontend is unaffected for the normal flow — confirm this is
acceptable.

### M-2 questions

**Q3 — Clearing fields via PATCH:**
Confirm: sending `PATCH /api/destinations/{id}` with `{"tag": null}` should
clear the `tag` field in the database (set it to NULL). Currently this is
silently ignored. Does the operator want this clearing behavior enabled?

**Q4 — Model validation:**
`DestinationUpdate` currently has all-optional fields defaulting to `None`.
With `exclude_unset=True`, fields not included in the request body are
excluded from the update. Confirm this is the desired PATCH semantics
(partial update, not full replacement).

---

## Implementation

### H-2 — Option A implementation

**`webapp/models.py`:**
```python
class ExecuteRequest(BaseModel):
    source_set: str
    full_path: str
    dest_set: str
    dest_subpath: str | None = None    # changed from required str
    dry_run: bool = False
```

**`webapp/app.py` execute route (~line 395):**
```python
dest_subpath = body.dest_subpath or suggest_destination_name(entry["display_name"])
plan = build_link_plan(entry, dest_root, dest_subpath)
```

**`webapp/frontend/src/api/types.ts`:**
```ts
export interface ExecuteRequest {
  source_set: string;
  full_path: string;
  dest_set: string;
  dest_subpath: string | null;   // changed from string
  dry_run: boolean;
}
```

### H-2 — Option B implementation

**`webapp/models.py`:**
```python
from pydantic import field_validator

class ExecuteRequest(BaseModel):
    source_set: str
    full_path: str
    dest_set: str
    dest_subpath: str

    @field_validator("dest_subpath")
    @classmethod
    def dest_subpath_nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("dest_subpath must not be empty")
        return v

    dry_run: bool = False
```

No route changes needed. No frontend changes needed.

### M-2 implementation

**`webapp/app.py:673`:**
```python
# Before:
patch: dict = {k: v for k, v in body.model_dump().items() if v is not None}

# After:
patch: dict = body.model_dump(exclude_unset=True)
```

That is the entire change for M-2.

---

## Files to read before starting

1. `webapp/models.py` — read `PreviewRequest`, `ExecuteRequest`, `DestinationUpdate`
2. `webapp/app.py` — read the execute route (~line 366–440) and the
   `update_destination` PATCH handler (~line 669–688)
3. `hardlink_organizer.py` — read `build_link_plan` to confirm the
   `if not dest_subpath:` fallback behavior
4. `tests/test_webapp.py` — grep for `dest_subpath` and `update_destination`
   to find affected tests

---

## Acceptance criteria

- [ ] Sending `dest_subpath: ""` to `/api/execute` either (A) falls back to a
      generated name visibly in the route, or (B) returns 422 — never silently
      diverges from the previewed path
- [ ] `PATCH /api/destinations/{id}` with `{"tag": null}` clears `tag` in the DB
- [ ] `PATCH /api/destinations/{id}` with `{}` leaves all fields unchanged
- [ ] All 185 existing tests pass
- [ ] Any new behavior is covered by at least one test

---

## Closure report

When the fix is complete, write a closure report to
`.raiden/writ/CLOSURE_H2_M2.md` with this structure:

```markdown
# Closure Report — H-2 + M-2

**Date:** <date>
**Commit:** <hash>
**Tests:** <N> passed, 0 failed

## H-2 — dest_subpath behavior
Option chosen: <A or B>
Files changed:
- <file> : <what changed>

## M-2 — PATCH field clearing
Files changed:
- <file> : <what changed>

## Open follow-ups
<any notes, or "none">
```

---

## Copy-paste excerpt for prime agent

After writing the closure report, print the following block so the operator
can paste it into the prime agent session:

```
**[H-2 + M-2] closed — commit `<hash>`**

H-2 option chosen: <A (dest_subpath Optional) or B (validator, reject empty)>

| Fix | File | Change |
|---|---|---|
| H-2 | webapp/models.py | <describe> |
| H-2 | webapp/app.py | <describe> |
| M-2 | webapp/app.py | line 673 — model_dump(exclude_unset=True) |

Tests: <N> passed, 0 failed.
```
