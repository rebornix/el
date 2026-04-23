# DECISIONS.md

## 2026-04-19 — Session/tunnel UX parity is a product contract

### Context
Recent cleanup/migration work regressed startup/session UX details (loading feedback, session row metadata, and role differentiation in rendering).

### Decision
Treat the following as required behavior (not optional polish):
- loading/progress feedback for tunnel/session navigation
- visually distinct user vs assistant rendering
- session list rows include title + folder + provider

### Consequences
- Refactors must preserve these UX contracts.
- Changes to these behaviors require explicit spec updates and review.

## 2026-04-22 — Shared TUI frame rendering and repainting is the default policy

### Context
Viewport sizing, footer placement, and repaint behavior were being handled independently across startup, session list, creation, and session screens. That led to inconsistent use of terminal height, bottom hints drifting upward, and visible flashing when navigation paths cleared and redrew the full screen on routine updates.

### Decision
Treat full-frame layout and repaint behavior as a shared TUI policy rather than per-screen behavior. Interactive screens should use shared frame/layout helpers so body rows and footer rows are computed consistently, with footer/help text anchored at the bottom of the viewport. Routine updates should repaint in place instead of issuing full-screen clears, while targeted line updates remain appropriate for high-frequency status changes such as auth spinners.

### Consequences
- New or refactored TUI screens should use the shared layout/repaint helpers instead of bespoke screen-clearing logic.
- Footer/help text is part of the frame contract and should remain bottom-anchored across interactive views.
- Viewport sizing and repaint behavior now count as cross-cutting implementation policy and should be preserved unless explicitly changed by a later decision.

## 2026-04-23 — "Do one thing well" is the module design policy

### Context
Codebase analysis found SRP violations concentrated in two orchestrator files (`pi-tui-interactive.ts` at 540 lines mixing state/I/O/rendering/API/4 screen modes, `startup-target.ts` at 260 lines mixing auth/TUI/navigation) with moderate violations in several others (`content-lines.ts`, `tunnel-auth.ts`, `tunnel-transport.ts`). Meanwhile, the `views/` key-model and model files already demonstrate good single-responsibility separation.

### Decision
Adopt "do one thing, do it right, do it well" as the project's module design policy. Enforce four concrete separation rules:

1. **Pure logic vs I/O** — compute/transform/decide functions must not perform I/O directly.
2. **State vs rendering** — state modules must not import rendering; renderers must not mutate state.
3. **Key handling vs screen rendering** — input mapping returns action objects; screen renderers consume state and produce frame data; they never share a file.
4. **Orchestration vs domain** — top-level wiring (event loops, lifecycle) is separate from domain logic (auth, protocol, viewport math).

Existing violations in `pi-tui-interactive.ts` and `startup-target.ts` are acknowledged tech debt. New work touching those files should split responsibility out rather than grow them further.

### Consequences
- New files must pass the "one sentence without 'and'" litmus test.
- PRs adding logic to known god-objects should include a decomposition step or explain why deferral is appropriate.
- The `views/` pattern (pure key-model + pure display-model + separate screen renderer) is the reference architecture for new TUI features.
