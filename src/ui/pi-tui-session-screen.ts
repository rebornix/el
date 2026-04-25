import { ResponsePartKind, ToolCallStatus, type ISessionState } from '../protocol/types/index.js';
import { buildSessionViewportModel } from '../views/session-view-model.js';
import { computeFrameBodyRows, renderScreenFrame } from './screen-frame.js';
import type { ContentLine } from '../content-lines.js';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function styleLine(line: ContentLine): string {
  switch (line.kind) {
    case 'user-label':
      return `${BOLD}${line.text}${RESET}`;
    case 'tool-status':
      return styleToolStatus(line.text);
    case 'tool-result':
      return `${DIM}${line.text}${RESET}`;
    case 'reasoning':
      return `${DIM}${line.text}${RESET}`;
    case 'content-ref':
      return `${DIM}${line.text}${RESET}`;
    case 'turn-error':
      return `${RED}${line.text}${RESET}`;
    case 'turn-cancel':
      return `${YELLOW}${line.text}${RESET}`;
    default:
      return line.text;
  }
}

function styleToolStatus(text: string): string {
  return text
    .replace(/([│├└] )(✓)/, `$1${GREEN}$2${RESET}`)
    .replace(/([│├└] )(✗)/, `$1${RED}$2${RESET}`)
    .replace(/([│├└] )([⟳…⏳])/, `$1${YELLOW}$2${RESET}`)
    .replace(/( — .+)$/, `${DIM}$1${RESET}`);
}

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
  const separatorRows = 1;
  const toolPromptRows = params.pendingToolCall
    ? 1 + (params.pendingToolCall.invocationMessage ? 1 : 0)
    : 0;
  const inputRows = params.pendingToolCall ? 0 : 1;
  const streamingRows = params.showStreamingIndicator ? 1 : 0;
  return separatorRows + toolPromptRows + inputRows + streamingRows;
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

  const lines = viewport.visibleLines.map(styleLine);

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

  const inputLine = `› ${inputBeforeCursor}▊${inputAfterCursor}`;

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
  lines.push(`${DIM}${'─'.repeat(params.termCols)}${RESET}`);
  if (screen.showStreamingIndicator) lines.push(`${DIM}▍ streaming${RESET}`);
  if (screen.toolPrompt) {
    lines.push(`${YELLOW}[tool]${RESET} ${BOLD}${screen.toolPrompt.displayName}${RESET}`);
    if (screen.toolPrompt.invocationMessage) {
      lines.push(`  ${DIM}${screen.toolPrompt.invocationMessage}${RESET}`);
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
