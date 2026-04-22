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
