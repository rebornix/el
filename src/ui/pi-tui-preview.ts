import { buildPiTuiSessionScreen } from './pi-tui-session-screen.js';
import type { ISessionState } from '../protocol/types/index.js';

/** Builds a non-interactive preview string for tests and diagnostics. */
export function renderPiTuiPreview(params: {
  sessionState: ISessionState | null;
  termCols?: number;
  termRows?: number;
  scrollLineOffset?: number;
  inputBeforeCursor?: string;
  inputAfterCursor?: string;
  debugHeader?: boolean;
}): string {
  const {
    sessionState,
    termCols = 80,
    termRows = 24,
    scrollLineOffset = 0,
    inputBeforeCursor = '',
    inputAfterCursor = '',
    debugHeader = true,
  } = params;

  const screen = buildPiTuiSessionScreen({
    sessionState,
    termCols,
    termRows,
    scrollLineOffset,
    inputBeforeCursor,
    inputAfterCursor,
  });

  const out: string[] = [];
  if (debugHeader) out.push('--- pi-tui preview ---');
  out.push(...screen.lines);

  if (screen.showStreamingIndicator) out.push('▍ streaming');

  if (screen.toolPrompt) {
    out.push(`[tool] ${screen.toolPrompt.displayName}`);
    if (screen.toolPrompt.invocationMessage) {
      out.push(`  ${screen.toolPrompt.invocationMessage}`);
    }
  } else if (screen.inputLine) {
    out.push(screen.inputLine);
  }

  return out.join('\n');
}
