import type { ISessionState } from '../protocol/types/index.js';
import { renderAllTurns, computeViewport, type ContentLine } from '../content-lines.js';

interface SessionViewportModel {
  visibleLines: ContentLine[];
  totalLines: number;
  maxScroll: number;
  hasBelow: boolean;
  startLine: number;
  endLine: number;
}

export function buildSessionViewportModel(params: {
  sessionState: ISessionState | null;
  termCols: number;
  termRows: number;
  scrollLineOffset: number;
  chromeOverhead?: number;
}): SessionViewportModel {
  const {
    sessionState,
    termCols,
    termRows,
    scrollLineOffset,
    chromeOverhead = 10,
  } = params;

  const availableLines = Math.max(10, termRows - chromeOverhead);

  if (!sessionState) {
    return {
      visibleLines: [],
      totalLines: 0,
      maxScroll: 0,
      hasBelow: false,
      startLine: 0,
      endLine: 0,
    };
  }

  const rendered = renderAllTurns(sessionState.turns, termCols);
  const { lines: allLines, turnLineCounts, turnStartLines } = rendered;

  const totalLines = allLines.length;
  const maxScroll = Math.max(0, totalLines - availableLines);

  const vp = computeViewport(
    totalLines,
    turnStartLines,
    turnLineCounts,
    scrollLineOffset,
    availableLines,
  );

  return {
    visibleLines: allLines.slice(vp.startLine, vp.endLine),
    totalLines,
    maxScroll,
    hasBelow: vp.hasBelow,
    startLine: vp.startLine,
    endLine: vp.endLine,
  };
}
