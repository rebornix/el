import { ResponsePartKind, ToolCallStatus, type ISessionState } from '../protocol/types/index.js';
import { buildSessionViewportModel } from '../views/session-view-model.js';
import { computeFrameBodyRows, renderScreenFrame } from './screen-frame.js';

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
  contentRows: number;
  showStreamingIndicator: boolean;
  inputLine?: string;
  toolPrompt?: {
    displayName: string;
    invocationMessage?: string;
  };
}

function getSessionChromeRows(params: {
  pendingToolCall: ReturnType<typeof findPendingToolCall>;
  showStreamingIndicator: boolean;
}): number {
  const toolPromptRows = params.pendingToolCall
    ? 1 + (params.pendingToolCall.invocationMessage ? 1 : 0)
    : 0;
  const inputRows = params.pendingToolCall ? 0 : 1;
  const streamingRows = params.showStreamingIndicator ? 1 : 0;
  return toolPromptRows + inputRows + streamingRows;
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

  const pendingToolCall = findPendingToolCall(sessionState);

  const buildViewport = (showStreamingIndicator: boolean) => buildSessionViewportModel({
    sessionState,
    termCols,
    termRows,
    scrollLineOffset,
    chromeOverhead: getSessionChromeRows({ pendingToolCall, showStreamingIndicator }),
  });

  let showStreamingIndicator = false;
  let viewport = buildViewport(false);
  if (!pendingToolCall && sessionState?.activeTurn && !viewport.hasBelow) {
    showStreamingIndicator = true;
    viewport = buildViewport(true);
  }
  const contentRows = Math.max(
    10,
    termRows - getSessionChromeRows({ pendingToolCall, showStreamingIndicator }),
  );

  const lines = viewport.visibleLines.map((l) => l.text);

  if (pendingToolCall) {
    return {
      lines,
      contentRows,
      showStreamingIndicator,
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

  return {
    lines,
    contentRows,
    showStreamingIndicator,
    inputLine,
  };
}

export function renderPiTuiSessionFrame(params: {
  sessionState: ISessionState | null;
  termCols: number;
  termRows: number;
  scrollLineOffset: number;
  inputBeforeCursor: string;
  inputAfterCursor: string;
  footerLine: string;
}): string {
  const footerLines = ['', params.footerLine];
  const bodyRows = computeFrameBodyRows(params.termRows, footerLines.length);
  const screen = buildPiTuiSessionScreen({
    sessionState: params.sessionState,
    termCols: params.termCols,
    termRows: bodyRows,
    scrollLineOffset: params.scrollLineOffset,
    inputBeforeCursor: params.inputBeforeCursor,
    inputAfterCursor: params.inputAfterCursor,
  });

  const lines = [...screen.lines];
  if (screen.showStreamingIndicator) lines.push('▍ streaming');
  if (screen.toolPrompt) {
    lines.push(`[tool] ${screen.toolPrompt.displayName}`);
    if (screen.toolPrompt.invocationMessage) {
      lines.push(`  ${screen.toolPrompt.invocationMessage}`);
    }
  } else if (screen.inputLine) {
    lines.push(screen.inputLine);
  }

  return renderScreenFrame({
    rows: params.termRows,
    bodyLines: lines,
    footerLines,
  });
}
