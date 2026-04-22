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
