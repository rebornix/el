# AGENTS.md — Agent Guide for `el`

> Working guide for agents and contributors.

## What `el` is

`el` is a CLI/TUI client for the Agent Host Protocol (AHP).

## Single source of truth

- **Commands**: `package.json` scripts are the source of truth.
  - Do not duplicate command lists here.
- **How to use `el`**: `docs/` is the source of truth.
  - `README.md` should stay minimal (quick start only).

## How to organize work

- `docs/` = user-facing usage docs (how to use `el`)
- `specs/` = implementation-facing specs (what to build), numbered to show sequence (e.g. `0-...`, `1-...`)
- `research/` = exploratory notes and insights that may inform future specs
- `DECISIONS.md` = architectural/technical decisions and rationale

## Contribution flow

1. (Optional) Capture exploration in `research/`.
2. Write/update a feature spec in `specs/`.
3. Implement code changes.
4. Update `docs/` and `README.md` (quick start only if needed) for user-visible changes.
5. Record notable technical tradeoffs in `DECISIONS.md`.

## Decision policy (`DECISIONS.md`)

- Log significant architecture/technical decisions with:
  - context
  - decision
  - consequences
- Treat the decision log as **append-only**:
  - do not rewrite old decisions
  - if a decision changes, add a new entry that references the prior one
- Keep entries short, concrete, and implementation-relevant.

## Specs/docs update policy

- If behavior changes, update `specs/` first (or in the same PR) so intended behavior is explicit.
- If user-visible behavior changes, update `docs/` in the same PR.
- Keep research insights in `research/`; promote them into `specs/` only when they become actionable.

## Protocol type provenance

- `src/protocol/types/` must be synced from the public VS Code repository only.
- Canonical VS Code source path: `src/vs/platform/agentHost/common/state/protocol`.
- Do not mix sources for these generated files.

## UI parity guardrails

- Do not remove or simplify UI states (loading/progress/errors) unless explicitly requested.
- For startup/tunnel/session navigation changes, keep behavior parity and add/update tests.
- Preserve high-signal list rows (title + folder + provider) unless product direction changes.
- Keep user vs assistant rendering visually distinct.

## Agent rules

- Keep changes focused and reviewable.
- Keep public content free of private/internal references.
- Do not commit secrets or tokens.
