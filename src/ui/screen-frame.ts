export const FRAME_PAD_LEFT = 1;
export const FRAME_PAD_BOTTOM = 1;

/** Usable rows after reserving bottom padding. */
export function usableRows(termRows: number): number {
  return Math.max(1, termRows - FRAME_PAD_BOTTOM);
}

/** Usable columns after reserving left padding. */
export function usableCols(termCols: number): number {
  return Math.max(20, termCols - FRAME_PAD_LEFT);
}

export function computeFrameBodyRows(rows: number, footerLineCount: number): number {
  return Math.max(1, rows - footerLineCount);
}

export function computeWindowRows(params: {
  rows: number;
  headerLineCount: number;
  footerLineCount: number;
  reservedLineCount?: number;
  minimumRows?: number;
}): number {
  const {
    rows,
    headerLineCount,
    footerLineCount,
    reservedLineCount = 0,
    minimumRows = 1,
  } = params;

  return Math.max(
    minimumRows,
    rows - headerLineCount - footerLineCount - reservedLineCount,
  );
}

export function renderScreenFrame(params: {
  rows: number;
  bodyLines: string[];
  footerLines: string[];
}): string {
  const bodyRows = computeFrameBodyRows(params.rows, params.footerLines.length);
  const lines = [...params.bodyLines];

  while (lines.length < bodyRows) {
    lines.push('');
  }

  return [...lines.slice(0, bodyRows), ...params.footerLines].join('\n');
}

export function paintScreenFrame(frame: string): string {
  const lines = frame.split('\n');
  const pad = ' '.repeat(FRAME_PAD_LEFT);
  return `\x1b[H${lines.map((line) => `${pad}${line}\x1b[K`).join('\n')}`;
}
