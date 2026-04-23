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
5. Record notable technical tradeoffs and cross-cutting implementation policies in `DECISIONS.md`.

## Decision policy (`DECISIONS.md`)

- Log significant architecture/technical decisions with:
  - context
  - decision
  - consequences
- Also record any cross-cutting implementation policy or reusable pattern that future changes are expected to follow.
- If a change establishes a preferred approach across multiple files, screens, modules, or flows, add a `DECISIONS.md` entry in the same PR.
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

## Design principle: do one thing well

Every file, module, and function should have a single clear responsibility.

**Separation rules:**

- **Pure logic vs I/O.** Functions that compute, transform, or decide should not read stdin, write stdout, or call APIs. Pass results out; let the caller do I/O.
- **State vs rendering.** Code that manages state (models, reducers, reconcilers) must not import rendering code. Code that renders frames must not mutate state.
- **Key handling vs screen rendering.** Keyboard input mapping returns action objects. Screen renderers consume state and produce frame data. They never share a file.
- **Orchestration vs domain.** Top-level wiring (event loops, lifecycle) is separate from domain logic (auth flows, protocol ops, viewport math).

**Litmus test for new files:**

Can you describe what this file does in one short sentence without "and"? If not, split it.

**Good examples already in the codebase:**

- `views/session-key-handler.ts` — maps keys to action objects, nothing else
- `views/session-list-model.ts` — computes session list display data, no I/O
- `ui/screen-frame.ts` — paints a frame to the terminal, no state logic
- `protocol/client.ts` — JSON-RPC client, typed command surface (moderate coupling, acceptable)

**Known violations (tech debt):**

- `ui/pi-tui-interactive.ts` — mixes orchestration, state, rendering, API calls, and 4 screen modes
- `ui/startup-target.ts` — mixes auth flow, TUI shell, and navigation

New work should not add to these files without splitting responsibility out first.

## Agent rules

- Keep changes focused and reviewable.
- Keep public content free of private/internal references.
- Do not commit secrets or tokens.
