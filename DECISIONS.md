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

## 2026-04-25 — ANSI styling applied after wrapping, never in content-lines

### Context
Content lines go through a pipeline: `content-lines.ts` produces plain-text `ContentLine[]` with `.text` and `.kind`, then `pi-tui-session-screen.ts` applies ANSI styling via `styleLine()`. `wrapText()` wraps by character count and would break if ANSI escape sequences were embedded in the text.

### Decision
ANSI color/style codes are applied in the rendering layer (`pi-tui-session-screen.ts`), never in the data layer (`content-lines.ts`). The `.kind` field on `ContentLine` carries semantic intent; the renderer maps kind → style.

### Consequences
- `content-lines.ts` must never import ANSI constants or embed escape sequences.
- New content line kinds require a corresponding case in `styleLine()`.
- Width calculations in `wrapText()` and `truncate()` remain simple character counting.

## 2026-04-25 — Global UI padding via screen-frame, not per-screen

### Context
Adding consistent padding (left margin, bottom margin) across all TUI screens required a single application point rather than per-screen adjustments.

### Decision
`screen-frame.ts` owns global padding via `FRAME_PAD_LEFT` and `FRAME_PAD_BOTTOM` constants. `paintScreenFrame` prepends left padding to every line. All screen builders use `usableRows()` and `usableCols()` to compute available space after padding. No screen should apply its own left/bottom padding.

### Consequences
- Changing global padding is a single constant change in `screen-frame.ts`.
- Screen builders must always use `usableRows()`/`usableCols()`, not raw terminal dimensions.
- Per-screen content padding (e.g., indentation within session chat) is additive on top of global padding.

## 2026-04-25 — Tool result text is trimmed and collapsed before rendering

### Context
Tool results (especially bash/shell output) often contain runs of blank lines from truncated terminal output. These rendered as excessive whitespace gaps in the session view.

### Decision
In `renderToolResultToLines`, text content is `.trim()`-ed and consecutive runs of 3+ newlines are collapsed to 2 (`\n\n`) before truncation and wrapping. This keeps at most one visual blank line between paragraphs of tool output.

### Consequences
- Tool result rendering is compact by default; no configuration needed.
- The 200-character truncation limit (`truncate(collapsed, 200)`) applies after collapsing, so more meaningful content fits within the budget.
- Future tool result types (embedded resources, file edits) are single-line and unaffected.
