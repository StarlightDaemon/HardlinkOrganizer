# Prompt 74: Fix H-1 — Inventory ID Instability

Recommended model:
- Claude Sonnet 4.6

Recommended mode:
- planning on

---

## Context

This is a fix loop for **H-1**, from `docs/v1-release-readiness-report.md`.

The full report is at `docs/v1-release-readiness-report.md`. C-1 (symlink bug) and
C-2/R-1/R-2/R-3 (version strings + Docker defaults) have already been fixed. H-1
is the next priority.

The operator is aware of this bug and has read the report. Your job is to:
1. Present the decision questions below to the operator
2. Agree on an approach
3. Implement, update both Python backend and React frontend, and verify tests pass

---

## Repository root

`/mnt/e/HardlinkOrganizer`

---

## The bug

### What goes wrong

`get_latest_inventory` in `engine/db.py` (line 195–216) fetches inventory rows from
the most recent scan, then **discards the real database primary key** and replaces it
with a sequential row counter:

```python
# engine/db.py:212
for idx, r in enumerate(rows, start=1):
    d = dict(r)
    d["id"] = idx          # throws away real DB PK, assigns positional offset
    result.append(d)
```

These positional IDs (`1, 2, 3, ...`) are what the frontend stores when it renders
the inventory list. When the user selects an entry and clicks Preview, the browser
sends:

```json
{ "source_set": "movies", "entry_id": 5, "dest_set": "lib_movies", ... }
```

The server resolves this at `webapp/app.py:324` and `app.py:379`:

```python
matched = [e for e in db_entries if e["id"] == body.entry_id]
```

**The race condition:** If a rescan runs between the time the user loaded the
inventory in their browser and the time they hit Preview or Execute, the new scan's
rows are now the "latest" — and the positional offsets are reassigned. Entry ID 5
may now point to a completely different item. No error is raised; the wrong source
path is silently linked into the destination.

### Second instance: live scan fallback path

When no DB scan exists, `scan_source_set` (`hardlink_organizer.py:280`) also
assigns positional IDs:

```python
for idx, child in enumerate(ordered, start=1):
    entry: InventoryEntry = { "id": idx, ... }
```

The live-fallback path in `app.py:327–332` and `app.py:382–387` uses the same
`e["id"] == body.entry_id` lookup. The same instability exists here — the live scan
order is filesystem-dependent and could vary between the initial load and a retry.

### What the frontend already has

The `InventoryEntry` object returned to the browser includes `full_path: string`
(the absolute path to the source entry). Both `DestStep.tsx` and `PreviewStep.tsx`
have `entry.full_path` available. It is **not** currently sent in requests; only
`entry_id` is.

---

## Fix options — present these to the operator and confirm one

### Option A — Use the real DB primary key (minimal, partial fix)

Remove the `d["id"] = idx` reassignment in `get_latest_inventory`. Use the
inventory table's actual auto-increment `id` column.

```python
# engine/db.py:212 — after fix
for r in rows:
    d = dict(r)
    # d["id"] stays as the real DB primary key — do NOT reassign
    result.append(d)
```

**What this fixes:** IDs are now stable for as long as the same scan is the latest
(i.e., no rescan has happened). Two calls to `get_latest_inventory` for the same
scan will return the same IDs.

**What this does NOT fix:** A rescan replaces all rows (new scan_id, new auto-
increment IDs). Any browser tab holding IDs from the previous scan will still get
wrong results. Also does not fix the live-scan fallback path (still positional).

**Frontend changes:** None — the frontend already handles `id` as an integer.

**Tradeoff:** Simple, safe, low-risk. Eliminates the within-scan instability but
not the cross-rescan race.

---

### Option B — Add `full_path` as a required cross-check field (belt-and-suspenders)

Keep `entry_id` in requests. Add `full_path: str` as an additional required field.
The server resolves by ID, then verifies the `full_path` matches. Mismatch → 409.

```python
# After ID-based lookup in app.py preview and execute routes:
if entry["full_path"] != body.full_path:
    raise HTTPException(
        409,
        "Inventory changed since this entry was selected — please reload and try again."
    )
```

**What this fixes:** Cross-rescan races are caught and reported. The user gets a
clear error instead of a silently wrong result.

**What this does NOT fix:** The `d["id"] = idx` bug is still present (combine with
Option A to address it). The live-scan fallback path is still positional.

**Frontend changes:** Add `full_path: entry.full_path` to `PreviewRequest` and
`ExecuteRequest` in both TypeScript types and the two component call sites
(`DestStep.tsx:23`, `PreviewStep.tsx:97`).

**Tradeoff:** Additive, non-breaking. Catches the bug at the boundary rather than
eliminating it at the source.

---

### Option C — Replace `entry_id` with `full_path` as the primary identifier (recommended)

Drop `entry_id` from `PreviewRequest` and `ExecuteRequest`. Replace with
`full_path: str`. The server resolves by looking up the matching entry in the
latest inventory by `full_path`:

```python
matched = [e for e in db_entries if e["full_path"] == body.full_path]
```

`full_path` is the natural stable identity of a source entry — it doesn't change
between rescans as long as the entry still exists on disk.

**What this fixes:** Eliminates the problem class entirely. No positional index is
ever sent over the wire. A rescan that adds or removes entries cannot corrupt a
pending preview or execute — either the entry is still found by path, or it returns
404 cleanly.

**Frontend changes:**
- `webapp/frontend/src/api/types.ts`: change `entry_id: number` → `full_path: string`
  in both `PreviewRequest` and `ExecuteRequest`
- `webapp/frontend/src/components/steps/DestStep.tsx:23`:
  change `entry_id: entry.id` → `full_path: entry.full_path`
- `webapp/frontend/src/components/steps/PreviewStep.tsx:97`:
  change `entry_id: entry.id` → `full_path: entry.full_path`

**Python model changes:**
- `webapp/models.py`: remove `entry_id: int`, add `full_path: str` from both
  `PreviewRequest` and `ExecuteRequest`

**Route changes:**
- `webapp/app.py:324,332,379,387`: change lookup from `e["id"] == body.entry_id`
  to `e["full_path"] == body.full_path`

**Tradeoff:** Breaking API change — any external client or script using `entry_id`
must be updated. If the API is internal-only and not yet documented as stable, this
is the cleanest option. If external clients exist, coordinate or version the API.

**The `d["id"] = idx` reassignment can be removed as a cleanup**, but it becomes
non-critical once nothing resolves by numeric ID.

---

## Questions to resolve with the operator before coding

Present these in order. The answers determine which option to implement.

**Q1 — API stability:** Is the `/api/preview` and `/api/execute` API used by
anything outside the bundled web frontend (scripts, external tools, automation)?
If yes, `entry_id` is part of a stable contract and Option C is breaking. If no,
Option C is the clean path.

**Q2 — Risk tolerance for cross-rescan races:** How often does rescan happen in
practice? Is this a single-user local install where the user controls rescan
timing? Or is it plausible that rescans are triggered while another session has
the inventory open? This determines whether Option A alone is acceptable or
whether B/C are needed.

**Q3 — Live-scan fallback:** The live-scan fallback path (no DB entry) also uses
positional IDs. Should the fix address only the DB read path, or both? For Option
C this is automatically fixed (lookup by `full_path` in both paths). For Option A
it is not.

**Q4 — What should happen when an entry is no longer in the latest inventory
after a rescan?** Should the server 404 (entry gone), or fall back to the previous
scan? Currently it always reads only the latest scan and 404s if not found. This
behavior can stay regardless of which fix option is chosen — just confirm.

---

## Files to read before starting

1. `engine/db.py` — read `get_latest_inventory` (line 195–216) and the inventory
   table insert path to confirm the DB `id` column type
2. `webapp/app.py` — read the `preview` route (line 311–360) and `execute` route
   (line 366–440) in full — both use `entry_id` resolution
3. `webapp/models.py` — read `PreviewRequest`, `ExecuteRequest`, `InventoryEntry`
4. `hardlink_organizer.py` — read `scan_source_set` (line 238–295) to understand
   the live-scan ID assignment
5. `webapp/frontend/src/api/types.ts` — read `PreviewRequest` and `ExecuteRequest`
   interfaces
6. `webapp/frontend/src/components/steps/DestStep.tsx` — line 17–36 (handlePreview)
7. `webapp/frontend/src/components/steps/PreviewStep.tsx` — find the execute call
   and read the surrounding context
8. `tests/test_webapp.py` — grep for `entry_id` to find affected test cases

---

## Implementation notes (after operator confirms approach)

### If Option A

- `engine/db.py:212–214`: remove the `d["id"] = idx` line; iterate without
  re-assigning id
- Run test suite; update any test that asserts `id == 1` or similar positional value
- The live-scan fallback path is out of scope for Option A — note this in a comment

### If Option B (likely in combination with A)

In addition to Option A:
- `webapp/models.py` `PreviewRequest`: add `full_path: str`
- `webapp/models.py` `ExecuteRequest`: add `full_path: str`
- `webapp/app.py` preview route (~line 337): after `entry = matched[0]`, add the
  cross-check
- `webapp/app.py` execute route (~line 392): same cross-check
- TypeScript: add `full_path: string` to both request interfaces in `types.ts`
- Frontend: add `full_path: entry.full_path` to both api call sites

### If Option C

- `webapp/models.py`: replace `entry_id: int` with `full_path: str` in both models
- `webapp/app.py` preview route lines 322–335: change lookup to `full_path`
- `webapp/app.py` execute route lines 377–390: change lookup to `full_path`
- `engine/db.py:212–214`: remove `d["id"] = idx` (cleanup — no longer used for
  routing, safe to remove)
- `hardlink_organizer.py`: the `id` field in `InventoryEntry` TypedDict can remain
  for backward compat with CLI code, but is no longer used in web routing
- TypeScript `types.ts`: replace `entry_id: number` with `full_path: string` in
  both request interfaces
- `DestStep.tsx:23`: `full_path: entry.full_path` (remove `entry_id` line)
- `PreviewStep.tsx:97`: same
- Tests: grep for `entry_id` in `tests/test_webapp.py` and update all affected
  request payloads

---

## Acceptance criteria

The fix is complete when:

- [ ] A rescan between inventory load and preview/execute cannot silently resolve
      the wrong source entry
- [ ] If a rescan results in the requested entry no longer existing, the server
      returns a clean 404 or 409 (not a wrong-entry match)
- [ ] All existing tests pass (currently 185 passing)
- [ ] Any test payloads using `entry_id` are updated to match the chosen fix
- [ ] The frontend (TypeScript) mirrors the backend change — request shapes match
- [ ] The live-scan fallback path is either fixed or explicitly documented as
      out-of-scope (with a follow-up note)
