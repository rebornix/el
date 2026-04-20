# Spec: Session List and Open UX Parity

## Goal

Preserve high-signal, low-latency session navigation UX in terminal mode.

## Requirements

1. Session list rows must include:
   - title
   - folder name
   - provider/agent type
2. Session rendering must visually differentiate user and assistant output.
3. Enter on a selected session must trigger immediate visible progress.
4. Tunnel list loading must show animated progress feedback.
5. Session open/create flows must show loading progress and clear failures.

## Acceptance Criteria

- User turns render with a `You` header and assistant turns with an `Assistant` header.
- Session list rows use one-line sanitized titles (no raw attachment/reminder payload blobs).
- Selecting a tunnel shows spinner/progress while fetching tunnels.
- Opening a session shows progress immediately and eventually opens session or returns a clear error.
- Creating a session shows progress and refreshes session list on completion.
