/**
 * Converts AHP turns into flat arrays of styled lines for
 * line-level viewport clipping. No React dependency.
 */

import type { ITurn, IActiveTurn, IResponsePart, IToolResultContent } from './protocol/types/index.js';
import {
  ResponsePartKind,
  ToolCallStatus,
  ToolResultContentType,
} from './protocol/types/index.js';

export type LineKind =
  | 'user-label'
  | 'user-text'
  | 'gap'
  | 'markdown'
  | 'tool-status'
  | 'tool-result'
  | 'reasoning'
  | 'content-ref'
  | 'turn-error'
  | 'turn-cancel'
  | 'streaming';

export interface ContentLine {
  text: string;
  kind: LineKind;
}

interface RenderedContent {
  /** Flat array of all lines across all turns */
  lines: ContentLine[];
  /** Number of lines per turn (same order as input turns) */
  turnLineCounts: number[];
  /** Starting line index for each turn */
  turnStartLines: number[];
}

interface ViewportInfo {
  /** First visible line index (inclusive) */
  startLine: number;
  /** Last visible line index (exclusive) */
  endLine: number;
  /** Index of first visible turn */
  firstTurnIdx: number;
  /** Index of last visible turn */
  lastTurnIdx: number;
  /** Total content lines */
  totalLines: number;
  /** Maximum scroll offset (lines from bottom) */
  maxScroll: number;
  /** Content exists above viewport */
  hasAbove: boolean;
  /** Content exists below viewport */
  hasBelow: boolean;
  /** Scroll position as percentage (100 = bottom, 0 = top) */
  scrollPercent: number;
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.length === 0) {
      lines.push('');
    } else if (rawLine.length <= width) {
      lines.push(rawLine);
    } else {
      for (let i = 0; i < rawLine.length; i += width) {
        lines.push(rawLine.slice(i, i + width));
      }
    }
  }
  return lines;
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function toolStatusIcon(status: string): string {
  switch (status) {
    case ToolCallStatus.Completed: return '✓';
    case ToolCallStatus.Running: return '⟳';
    case ToolCallStatus.Streaming: return '…';
    case ToolCallStatus.PendingConfirmation: return '⏳';
    case ToolCallStatus.PendingResultConfirmation: return '⏳';
    case ToolCallStatus.Cancelled: return '✗';
    default: return '?';
  }
}

export function renderTurnToLines(turn: ITurn | IActiveTurn, termCols: number): ContentLine[] {
  const lines: ContentLine[] = [];
  // Leave room for margins/borders
  const contentWidth = Math.max(20, termCols - 6);

  // ── User message ──
  lines.push({ text: '  You', kind: 'user-label' });
  const userText = turn.userMessage.text || '';
  for (const wrapped of wrapText(userText, contentWidth)) {
    lines.push({ text: '  │ ' + wrapped, kind: 'user-text' });
  }
  lines.push({ text: '', kind: 'gap' });

  // ── Assistant response ──
  lines.push({ text: '  Assistant', kind: 'user-label' });
  const parts = turn.responseParts;
  for (let i = 0; i < parts.length; i++) {
    let toolConnector: string | undefined;
    if (parts[i].kind === ResponsePartKind.ToolCall) {
      const prevIsTC = i > 0 && parts[i - 1].kind === ResponsePartKind.ToolCall;
      const nextIsTC = i + 1 < parts.length && parts[i + 1].kind === ResponsePartKind.ToolCall;
      const inGroup = prevIsTC || nextIsTC;
      toolConnector = inGroup ? (nextIsTC ? '├' : '└') : '│';
    }
    renderPartToLines(parts[i], contentWidth, lines, toolConnector);
  }

  // ── Turn state indicators ──
  if ('state' in turn) {
    const t = turn as ITurn;
    if (t.state === 'cancelled') {
      lines.push({ text: '⚠ Turn cancelled', kind: 'turn-cancel' });
    }
    if (t.state === 'error') {
      const errMsg = t.error ? `: ${t.error.message}` : '';
      lines.push({ text: `✗ Turn failed${errMsg}`, kind: 'turn-error' });
    }
  }

  // Gap between turns
  lines.push({ text: '', kind: 'gap' });
  return lines;
}

function renderPartToLines(part: IResponsePart, contentWidth: number, lines: ContentLine[], toolConnector?: string): void {
  switch (part.kind) {
    case ResponsePartKind.Markdown: {
      if (!part.content) return;
      for (const wrapped of wrapText(part.content, contentWidth)) {
        lines.push({ text: '  │ ' + wrapped, kind: 'markdown' });
      }
      return;
    }

    case ResponsePartKind.ToolCall: {
      const tc = part.toolCall;
      const icon = toolStatusIcon(tc.status);
      const connector = toolConnector ?? '│';
      let label = `${icon} ${tc.displayName}`;
      if ('invocationMessage' in tc && tc.invocationMessage) {
        const raw = typeof tc.invocationMessage === 'string'
          ? tc.invocationMessage
          : tc.invocationMessage.markdown;
        // prefix "  ├ " (4) + label + " — " (3) = overhead before message
        const msgBudget = contentWidth - 4 - label.length - 3;
        label += ` — ${truncate(stripMarkdownLinks(raw), Math.max(20, msgBudget))}`;
      }
      lines.push({ text: `  ${connector} ${label}`, kind: 'tool-status' });

      // Indent child lines under tool status
      const resultPrefix = '      ';

      // Tool results
      if ('content' in tc && Array.isArray(tc.content)) {
        for (const c of tc.content as IToolResultContent[]) {
          renderToolResultToLines(c, contentWidth, lines, resultPrefix);
        }
      }

      // Tool error
      if ('error' in tc && tc.error) {
        const message = typeof tc.error === 'object' && tc.error && 'message' in tc.error
          ? String((tc.error as { message?: string }).message ?? 'Error')
          : 'Error';
        lines.push({ text: `${resultPrefix}⚠ ${message}`, kind: 'turn-error' });
      }
      return;
    }

    case ResponsePartKind.Reasoning: {
      if (!part.content) return;
      // prefix "  │ 💭 " = 7 visible chars (💭 is double-width)
      lines.push({ text: `  │ 💭 ${truncate(part.content, contentWidth - 7)}`, kind: 'reasoning' });
      return;
    }

    case ResponsePartKind.ContentRef: {
      let label = `📎 ${part.uri}`;
      if (part.contentType) label += ` (${part.contentType})`;
      lines.push({ text: '  │ ' + truncate(label, contentWidth - 4), kind: 'content-ref' });
      return;
    }
  }
}

function renderToolResultToLines(c: IToolResultContent, contentWidth: number, lines: ContentLine[], prefix: string): void {
  const maxLen = contentWidth - prefix.length;
  switch (c.type) {
    case ToolResultContentType.Text: {
      const collapsed = c.text.replace(/\n{3,}/g, '\n\n').trim();
      const txt = truncate(collapsed, 200);
      for (const wrapped of wrapText(txt, maxLen)) {
        lines.push({ text: prefix + wrapped, kind: 'tool-result' });
      }
      return;
    }
    case ToolResultContentType.EmbeddedResource: {
      const body = `📦 embedded ${c.contentType || ''} (${c.data?.length || 0} bytes b64)`;
      lines.push({ text: prefix + truncate(body, maxLen), kind: 'tool-result' });
      return;
    }
    case ToolResultContentType.Resource: {
      let body = `📎 ${c.uri}`;
      if (c.contentType) body += ` (${c.contentType})`;
      lines.push({ text: prefix + truncate(body, maxLen), kind: 'tool-result' });
      return;
    }
    case ToolResultContentType.FileEdit: {
      let body = '📝 ';
      const before = c.before?.uri;
      const after = c.after?.uri;
      if (!before && after) body += `created ${after}`;
      else if (before && !after) body += `deleted ${before}`;
      else if (before && after && before !== after) body += `renamed ${before} → ${after}`;
      else body += `edited ${after ?? before ?? 'file'}`;
      if (c.diff) {
        const parts: string[] = [];
        if (c.diff.added) parts.push(`+${c.diff.added}`);
        if (c.diff.removed) parts.push(`-${c.diff.removed}`);
        if (parts.length) body += ` (${parts.join(', ')})`;
      }
      lines.push({ text: prefix + truncate(body, maxLen), kind: 'tool-result' });
      return;
    }
  }
}

export function renderAllTurns(
  turns: readonly (ITurn | IActiveTurn)[],
  termCols: number,
): RenderedContent {
  const allLines: ContentLine[] = [];
  const turnLineCounts: number[] = [];
  const turnStartLines: number[] = [];

  for (const turn of turns) {
    turnStartLines.push(allLines.length);
    const turnLines = renderTurnToLines(turn, termCols);
    turnLineCounts.push(turnLines.length);
    allLines.push(...turnLines);
  }

  return { lines: allLines, turnLineCounts, turnStartLines };
}

/** Compute which lines are visible given scroll offset from bottom. */
export function computeViewport(
  totalLines: number,
  turnStartLines: readonly number[],
  turnLineCounts: readonly number[],
  scrollLineOffset: number,
  availableLines: number,
): ViewportInfo {
  const totalTurns = turnLineCounts.length;
  const maxScroll = Math.max(0, totalLines - availableLines);
  const clamped = Math.min(Math.max(0, scrollLineOffset), maxScroll);

  // Viewport line range
  const endLine = totalLines - clamped;
  const startLine = Math.max(0, endLine - availableLines);

  // Find which turns overlap [startLine, endLine)
  let firstTurnIdx = 0;
  let lastTurnIdx = Math.max(0, totalTurns - 1);

  for (let i = 0; i < totalTurns; i++) {
    const turnEnd = turnStartLines[i] + turnLineCounts[i];
    if (turnEnd > startLine) {
      firstTurnIdx = i;
      break;
    }
  }

  for (let i = totalTurns - 1; i >= 0; i--) {
    if (turnStartLines[i] < endLine) {
      lastTurnIdx = i;
      break;
    }
  }

  const hasAbove = startLine > 0;
  const hasBelow = clamped > 0;
  const scrollPercent = maxScroll > 0
    ? Math.round(100 * (1 - clamped / maxScroll))
    : 100;

  return {
    startLine,
    endLine,
    firstTurnIdx,
    lastTurnIdx,
    totalLines,
    maxScroll,
    hasAbove,
    hasBelow,
    scrollPercent,
  };
}
