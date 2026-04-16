# Agent Ledger Standard

## Required evidence labels

All non-trivial statements must be marked as one of:

- `Confirmed`: directly supported by inspected evidence
- `Inferred`: reasoned from evidence, but not directly observed
- `Unverified`: plausible or reported, but not yet confirmed

## Required provenance for major outputs

Major outputs must include:

- model
- reasoning level
- date
- inputs
- confidence

## Required loop execution model

All execution work must flow through `OPEN_LOOPS.md`.

Each loop must define:

- loop ID
- title
- status
- scope
- readiness
- evidence plan
- validation plan
- closure condition

## Required conflict handling

- contradictions must not be erased
- unresolved conflicts remain open
- conflicts should be linked to `OPEN_LOOPS.md` or `EXCEPTIONS.md`

## Required terminology handling

- acronyms and ambiguous terms belong in `TERMS.md`
- new undefined terms should be added before they are used broadly

## Project interaction rule

- the ledger is the control plane
- project files are implementation artifacts
- implementation changes should be traceable to ledger work

## Bootstrap note

- Confirmed: this standard was created when Hardlink Organizer was promoted into its own project workspace.
- Inferred: the standard may evolve, but governance documents must remain explicitly controlled.

## Provenance

- Model: GPT-5 Codex
- Reasoning level: structured workspace promotion
- Date: 2026-04-16
- Inputs: existing repo-level Agent Ledger standard and user direction to give Hardlink Organizer its own ledger
- Confidence: high
