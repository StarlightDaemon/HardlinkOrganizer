# Agent Handoff — File-entry subfolder wrapping for Radarr-compatible linking

You are implementing a focused feature in the HardlinkOrganizer project at `E:\Citadel/HardlinkOrganizer`. Read every file referenced below before writing a single line of code. The codebase is clean and consistent — match its style exactly.

---

## Problem

When a source entry is a **file** (e.g. `Mortal Kombat (1995) UpScaled 2160p H265 10 bit DV HDR10+ ita AC3 2.0 eng AC3 5.1 sub ita eng NUita NUeng-Licdom.mkv`), HLO currently produces a flat destination path:

```
/mnt/disk2/moviesuhd/Mortal Kombat (1995) UpScaled 2160p H265 10 bit DV HDR10+ ita AC3 2 0 eng AC3 5 1 sub ita eng NUita NUeng-Licdom
```

This is wrong in two ways: no file extension, and no wrapping folder. Radarr and Plex expect:

```
/mnt/disk2/moviesuhd/Mortal Kombat (1995)/Mortal Kombat (1995).mkv
```

Directory entries are unaffected — they already link correctly as `{dest_root}/{dir_name}/`.

---

## Files to read in full before starting

- `hardlink_organizer.py` — focus on `suggest_destination_name` (line 220), `build_link_plan` (line 766), `LinkPlan.__init__` (line 687), and `execute_link_plan` (line 894)
- `webapp/app.py` — focus on the `preview` endpoint (~line 523) and `execute` endpoint (~line 600); both call `suggest_destination_name` and `build_link_plan`
- `webapp/models.py` — `PreviewResponse` (line 89) and `PreviewRequest` (line 74); note `dest_subpath` fields
- `webapp/frontend/src/components/steps/PreviewStep.tsx` — the full component; note `DetailRow` for `dest_full`, the `dest_subpath` sent to execute
- `webapp/frontend/src/api/types.ts` — `PreviewResponse` TypeScript interface
- `tests/test_hardlink_organizer.py` — understand the test pattern before writing new tests

---

## Exact changes required

### 1. `hardlink_organizer.py` — add `_extract_clean_title` and update `suggest_destination_name`

Add a new private helper after `suggest_destination_name` (around line 222):

```python
_QUALITY_TAGS_RE = re.compile(
    r'\b(2160p|1080p|720p|480p|BluRay|BDRip|BRRip|WEB[-.]?DL|WEBRip|REMUX|'
    r'HDR|HDR10|DV|UHD|x264|x265|H\.?264|H\.?265|AV1|HEVC|UpScaled)\b',
    re.IGNORECASE,
)

def _extract_clean_title(display_name: str) -> str:
    """Return just the title and year from a display name, stripping quality/encoding tags."""
    # If a (YYYY) year token is present, cut everything after it
    m = re.search(r'\(\d{4}\)', display_name)
    if m:
        return display_name[:m.end()].strip()
    # No year — cut at first quality tag if present
    m2 = _QUALITY_TAGS_RE.search(display_name)
    if m2:
        return display_name[:m2.start()].strip()
    return display_name.strip()
```

Then update `suggest_destination_name` to accept an optional `entry_type` and `source_path`:

```python
def suggest_destination_name(
    display_name: str,
    entry_type: str = "dir",
    source_path: str = "",
) -> str:
    """Return the suggested dest_subpath for a link plan."""
    if entry_type == "file":
        clean = _extract_clean_title(display_name)
        ext = Path(source_path).suffix if source_path else ""
        return f"{clean}/{clean}{ext}"
    return display_name
```

The existing `suggest_destination_name(display_name)` call signature (one argument, no entry_type) must continue to work — the new parameters default to `"dir"` and `""` so existing callers that don't pass them are unaffected.

### 2. `webapp/app.py` — pass entry_type and full_path to `suggest_destination_name`

In both the `preview` endpoint (~line 550) and `execute` endpoint (~line 606), the fallback call currently reads:

```python
dest_subpath = body.dest_subpath or suggest_destination_name(entry["display_name"])
```

Change both to:

```python
dest_subpath = body.dest_subpath or suggest_destination_name(
    entry["display_name"],
    entry_type=entry["entry_type"],
    source_path=entry["full_path"],
)
```

No other changes to `app.py`.

### 3. `webapp/frontend/src/components/steps/PreviewStep.tsx` — editable folder name for file entries

For file entries, the user should be able to override the destination folder name (the clean title) before executing. Add:

- A `useState<string>` initialised from `preview.dest_subpath` (the full subpath)
- For file entries, extract the folder name from `dest_subpath` (everything before the last `/`) and render it as a text input below the Destination `DetailRow`
- Label the input `"Destination folder name"` 
- When the user edits the input, update local state; derive a new `dest_subpath` as `{edited_name}/{edited_name}{ext}` where `ext` is extracted from the original `preview.dest_subpath`
- Pass the local (possibly edited) `dest_subpath` to the `api.execute()` call instead of `preview.dest_subpath`
- For directory entries, no editable input — existing behaviour unchanged

Keep the `DetailRow` for Destination showing `preview.dest_full` (the server-computed path) as-is; the editable input is additive below it.

### 4. `webapp/frontend/src/api/types.ts` — no changes needed

`PreviewResponse` already has `dest_subpath: string`. The editable override flows through execute's `dest_subpath` field which is already there.

### 5. `tests/test_hardlink_organizer.py` — add tests for `_extract_clean_title` and the updated `suggest_destination_name`

Add a `TestExtractCleanTitle` class:

- `"Mortal Kombat (1995) UpScaled 2160p H265 10 bit..."` → `"Mortal Kombat (1995)"`
- `"Tron Legacy (2010) 2160p HDR BluRay AV1..."` → `"Tron Legacy (2010)"`
- `"Arrival (2016)"` → `"Arrival (2016)"` (no trailing junk, no truncation)
- `"Some Movie Without Year 2160p BluRay"` → `"Some Movie Without Year"` (quality tag cut, no year)
- `"Clean Title"` → `"Clean Title"` (no year, no quality tag — return as-is)

Add a `TestSuggestDestinationName` class:

- `suggest_destination_name("Mortal Kombat (1995) UpScaled 2160p...", entry_type="file", source_path="...Mortal Kombat.mkv")` → `"Mortal Kombat (1995)/Mortal Kombat (1995).mkv"`
- `suggest_destination_name("Show Name", entry_type="dir")` → `"Show Name"` (unchanged)
- `suggest_destination_name("Show Name")` → `"Show Name"` (no entry_type arg — backward compat)

---

## Constraints

- Do not change `LinkPlan`, `execute_link_plan`, or `hardlink_file` — `dest_subpath` containing a slash (`"Mortal Kombat (1995)/Mortal Kombat (1995).mkv"`) already resolves correctly via `Path(dest_root) / dest_subpath`, and `hardlink_file` already calls `dst.parent.mkdir(parents=True, exist_ok=True)` before `os.link`, so the subfolder will be created automatically
- Do not change `webapp/models.py` — no schema changes needed
- Do not change history display, BrowseStep, or any other step
- The one-argument form `suggest_destination_name(display_name)` must remain valid — existing CLI and interactive flow callers must not break

---

## Verification

```bash
cd E:\Citadel/HardlinkOrganizer && python3 -m unittest discover -s ./tests -v 2>&1 | tail -20
```

All existing tests must pass. Report what passed, what failed, and what you changed.
