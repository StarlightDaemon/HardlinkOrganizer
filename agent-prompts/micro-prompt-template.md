# Micro Prompt Template

Use this to dispatch another agent to one narrow prompt file.

```text
Work only on the prompt located at:
PROMPT_FILE_PATH

Repository root:
/mnt/e/HardlinkOrganizer

Authoritative workspace rule:
- The only live repo root for this project is `/mnt/e/HardlinkOrganizer`.
- On Windows, that same root is `E:\HardlinkOrganizer`.
- Do not work from `StarlightDaemonDev/tools/internal/hardlink-organizer`.
- If your current working directory is not the standalone root, stop and report it immediately.

Instructions:
- Open that file first and follow it exactly.
- Keep scope limited to that one prompt.
- Do not widen into adjacent cleanup or redesign work.
- If you hit a blocker, stop and report it instead of broadening the task.

Final response requirements:
- list changed files
- summarize what you completed
- state what you verified
- call out any residual risks or blockers
```

## Example

```text
Work only on the prompt located at:
./agent-prompts/prompt-02-web-dependency-verification.md

Repository root:
/mnt/e/HardlinkOrganizer

Authoritative workspace rule:
- The only live repo root for this project is `/mnt/e/HardlinkOrganizer`.
- On Windows, that same root is `E:\HardlinkOrganizer`.
- Do not work from `StarlightDaemonDev/tools/internal/hardlink-organizer`.
- If your current working directory is not the standalone root, stop and report it immediately.

Instructions:
- Open that file first and follow it exactly.
- Keep scope limited to that one prompt.
- Do not widen into adjacent cleanup or redesign work.
- If you hit a blocker, stop and report it instead of broadening the task.

Final response requirements:
- list changed files
- summarize what you completed
- state what you verified
- call out any residual risks or blockers
```
