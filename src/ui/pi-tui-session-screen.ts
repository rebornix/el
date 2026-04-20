import { ResponsePartKind, ToolCallStatus, type ISessionState } from '../protocol/types/index.js';
import { buildSessionViewportModel } from '../views/session-view-model.js';

function findPendingToolCall(sessionState: ISessionState | null) {
  const parts = sessionState?.activeTurn?.responseParts;
  if (!parts) return null;
  for (const part of parts) {
    if (part.kind !== ResponsePartKind.ToolCall) continue;
    const status = part.toolCall.status;
    if (status === ToolCallStatus.PendingConfirmation || status === ToolCallStatus.PendingResultConfirmation) {
      return part.toolCall;
    }
  }
  return null;
}

interface PiTuiSessionScreen {
  lines: string[];
  showStreamingIndicator: boolean;
  inputLine?: string;
  toolPrompt?: {
    displayName: string;
    invocationMessage?: string;
  };
}

/** Build session screen model: visible lines, input bar, tool prompts. */
export function buildPiTuiSessionScreen(params: {
  sessionState: ISessionState | null;
  termCols: number;
  termRows: number;
  scrollLineOffset: number;
  inputBeforeCursor: string;
  inputAfterCursor: string;
}): PiTuiSessionScreen {
  const {
    sessionState,
    termCols,
    termRows,
    scrollLineOffset,
    inputBeforeCursor,
    inputAfterCursor,
  } = params;

  const viewport = buildSessionViewportModel({
    sessionState,
    termCols,
    termRows,
    scrollLineOffset,
  });

  const lines = viewport.visibleLines.map((l) => l.text);
  const pendingToolCall = findPendingToolCall(sessionState);

  if (pendingToolCall) {
    return {
      lines,
      showStreamingIndicator: false,
      toolPrompt: {
        displayName: pendingToolCall.displayName,
        invocationMessage:
          typeof pendingToolCall.invocationMessage === 'string'
            ? pendingToolCall.invocationMessage
            : pendingToolCall.invocationMessage?.markdown,
      },
    };
  }

  const inputLine = `> ${inputBeforeCursor}▊${inputAfterCursor}`;
  const showStreamingIndicator = Boolean(sessionState?.activeTurn) && !viewport.hasBelow;

  return {
    lines,
    showStreamingIndicator,
    inputLine,
  };
}
