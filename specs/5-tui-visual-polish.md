# Spec: TUI Visual Polish

## Goal

Improve the visual quality, consistency, and readability of the terminal UI across all screens — startup, navigation, and session chat.

## Requirements

### Startup & Navigation Screens

1. ASCII banner ("el" block logo) displayed centered on all non-session screens (menu, tunnel list, session list, direct URL input).
2. Banner uses cyan bold styling and is always visible until a session is opened.
3. One empty line above banner for top padding.

### Global Layout

4. Global padding: 1 column left, 1 row bottom — applied uniformly via `paintScreenFrame`.
5. All screen builders use `usableRows()` / `usableCols()` to account for padding.

### Loader & Progress

6. Gradient loader (gray→white→gray shimmer) as default style.
7. Single "Loading…" spinner for the entire connect → initialize → session-list sequence (no two-phase flicker).
8. Spinner renders immediately on first frame (`shouldRender: true`).

### Session Chat Rendering

9. ANSI color styling: bold user labels, dim tool results/reasoning, colored tool status icons (green ✓, red ✗, yellow ⟳).
10. `─` separator line and `›` prompt for the input area.
11. Tree connectors (`├`/`└`) for consecutive tool call groups; plain indentation for tool result child lines.
12. Markdown link stripping in tool invocation messages (`[text](url)` → `text`).
13. All content lines (tool results, reasoning, content-ref, invocation) truncated to `contentWidth`.
14. Consecutive blank lines in tool result text collapsed (3+ newlines → 2).

### Navigation Flow

15. Redundant title + spinner text consolidated (title IS the context).
16. Unified `…` ellipsis style across all spinners.
17. Session list rows: `○ title  [folder] (provider)` format with truncation.
18. Create row aligned with selection indicators.

## Acceptance Criteria

- Banner is visible and centered on menu, tunnel list (all states), session list (all states), and direct URL input.
- No flicker or flash during connect → session list transition.
- Tool results with many blank lines render compactly (no runs of 3+ empty lines).
- All lines fit within terminal width (no overflow/wrapping artifacts).
- Gradient loader animates smoothly at 150ms/frame.
- Left padding is consistent across all screens.
