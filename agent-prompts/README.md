# Agent Prompts

Narrow, single-slice prompts for unstable or high-traffic agent runs.

## Prompt files

- `prompt-00-fresh-chat-ledger-restart.md`
- `prompt-01-packaging-smoke-check.md`
- `prompt-02-web-dependency-verification.md`
- `prompt-03-real-unraid-validation-prep.md`
- `prompt-10-release-hardening-pass.md`
- `prompt-20-unraid-preflight-hardening.md`
- `prompt-30-verification-job-foundation.md`
- `prompt-31-verification-followup-exports-and-history-lookup.md`
- `prompt-32-history-driven-verification-ui.md`
- `prompt-40-destination-registry-validation-backend.md`

## Micro prompt

Use `micro-prompt-template.md` to dispatch another agent to exactly one prompt file without re-explaining the project.

## Recommended usage

1. Pick one prompt file.
2. Paste the micro prompt.
3. Replace `PROMPT_FILE_PATH` with the exact prompt file path.
4. Let the other agent handle only that slice.
