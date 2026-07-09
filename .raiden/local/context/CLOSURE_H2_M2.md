# Closure Report — H-2 + M-2

**Date:** 2026-06-01
**Commit:** e9a0407
**Tests:** 195 passed, 0 failed

## H-2 — dest_subpath behavior
Option chosen: A (dest_subpath Optional[str] = None)

Files changed:
- `webapp/models.py` : `ExecuteRequest.dest_subpath` changed from required `str` to `str | None = None`, matching `PreviewRequest`
- `webapp/app.py` : execute route (~line 395) now applies `suggest_destination_name()` fallback explicitly before calling `build_link_plan`, making the substitution visible in the route rather than buried inside the helper
- `webapp/frontend/src/api/types.ts` : `ExecuteRequest.dest_subpath` updated from `string` to `string | null`
- `tests/test_webapp.py` : added `test_execute_null_dest_subpath_uses_generated_name` and `test_execute_empty_string_dest_subpath_uses_generated_name`

## M-2 — PATCH field clearing
Files changed:
- `webapp/app.py` : line 673 — replaced `{k: v for k, v in body.model_dump().items() if v is not None}` with `body.model_dump(exclude_unset=True)`; clients can now send `{"tag": null}` to clear the field, and `{}` is a true no-op
- `tests/test_webapp.py` : added `test_patch_destination_clears_tag_with_null` and `test_patch_destination_empty_body_is_noop`

## Open follow-ups
none
