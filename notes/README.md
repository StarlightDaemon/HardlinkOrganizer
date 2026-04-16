# Hardlink Organizer Notes

These files are tool-specific planning and transition notes that used to live at
the repo level. They now stay with `hardlink-organizer/` so the whole project can
be moved into its own workspace with less cleanup.

- `plans/`: nested implementation and release plans that no longer need root-level placement
- `WORKSPACE_CONTEXT.md`: transition note for repo-level versus project-local context
- `HARDLINK_ORGANIZER_NEXT_STEPS.md`: short-term product priorities
- `HARDLINK_ORGANIZER_FEATURE_EXPANSION_PLAN.md`: staged feature roadmap
- `COMMUNITY_APPS_ROADMAP.md`: Community Apps release path
- `CA_STEP_01_UNRAID_VALIDATION_PLAN.md`: real-host Unraid validation plan
- `VERIFICATION_UI_VALIDATION_NOTE.md`: what actually happened during prompt-32 validation, why `TestClient` was replaced in tests, and what the remaining caveat is
- `PROJECT_WORKSPACE_EXTRACTION_PLAN.md`: staged plan for moving Hardlink Organizer into its own top-level workspace and repo

## Recommended reading order

1. `README.md` at the repository root for the product front page
2. `../agent-ledger/README.md` for the project control plane
3. `../agent-ledger/CURRENT_STATE.md` for the current evidence-based snapshot
4. `HARDLINK_ORGANIZER_NEXT_STEPS.md` for near-term product direction
5. `plans/README.md` if you need older implementation or release planning
