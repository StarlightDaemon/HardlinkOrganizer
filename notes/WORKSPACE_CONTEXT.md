# Hardlink Organizer Workspace Context

This file is now a transition note.

Hardlink Organizer has been promoted into its own project workspace and no
longer depends on the parent repository ledger as its primary control plane.

## Read this instead

Start with these local project files:

1. `agent-ledger/README.md`
2. `agent-ledger/CURRENT_STATE.md`
3. `agent-ledger/OPEN_LOOPS.md`
4. `README.md`
5. `notes/README.md`

## What changed

- `agent-ledger/` inside this workspace is now the authoritative continuity layer
- parent-repo ledger files are now summary material only for cross-repo context
- local prompts and repo-tooling files are being aligned to this project root

## When repo-level docs still matter

Reach into the parent repository only when you need:

- cross-repo governance context
- tool-catalog updates outside this project
- parent-repo inventory or publication context
