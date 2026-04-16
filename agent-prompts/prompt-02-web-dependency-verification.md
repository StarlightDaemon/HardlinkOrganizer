# Prompt 02: Web Dependency Verification

Do a dependency and test-environment verification pass for the Hardlink Organizer web app.

Repository root:
`/mnt/e/HardlinkOrganizer`

Read first:
1. `./requirements.txt`
2. `./tests/test_webapp.py`
3. `./webapp/run.py`
4. `./README.md`

Task:
Check that the declared Python dependencies match what the web app and tests actually import and use. Tighten docs or requirements only if needed.

Scope:
- `requirements.txt`
- test and runtime dependency clarity
- local run instructions

Do not:
- refactor app logic
- change API behavior
- add new product features

Validation:
- run the smallest relevant test command available
- state what could not be verified locally

Final response:
- list changed files
- summarize runtime dependencies
- report verification results
