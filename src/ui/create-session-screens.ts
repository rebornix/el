import { computeWindowRows, renderScreenFrame } from './screen-frame.js';
import { computeSelectionWindow } from '../views/selection-window.js';
import { computeFolderWindow } from '../views/folder-picker-model.js';
import { uriToDisplayPath } from '../uri-helpers.js';

export function renderCreateAgentFrame(params: {
  providers: string[];
  selectedIndex: number;
  rows: number;
  statusMessage?: string;
}): string {
  const footerLines = [
    ...(params.statusMessage ? [params.statusMessage] : []),
    '↑/↓ select · Enter next · Esc back',
  ];
  const headerLines = ['Create Session — Choose Agent', ''];
  const windowRows = computeWindowRows({
    rows: params.rows,
    headerLineCount: headerLines.length,
    footerLineCount: footerLines.length,
    reservedLineCount: 2,
    minimumRows: 5,
  });

  const window = computeSelectionWindow({
    totalItems: Math.max(1, params.providers.length),
    selectedIndex: params.selectedIndex,
    windowSize: windowRows,
  });

  const bodyLines = [...headerLines];
  if (params.providers.length === 0) {
    bodyLines.push('No agents available');
  } else {
    if (window.hasAbove) bodyLines.push('↑ more');
    for (let i = window.startIdx; i < window.endIdx; i++) {
      const provider = params.providers[i];
      if (!provider) continue;
      bodyLines.push(`${i === params.selectedIndex ? '❯' : ' '} ${provider}`);
    }
    if (window.hasBelow) bodyLines.push('↓ more');
  }

  return renderScreenFrame({
    rows: params.rows,
    bodyLines,
    footerLines,
  });
}

export function renderFolderPickerFrame(params: {
  currentUri: string;
  entries: { name: string; display: string; isDir: boolean }[];
  selectedIndex: number;
  rows: number;
  statusMessage?: string;
}): string {
  const footerLines = [
    ...(params.statusMessage ? [params.statusMessage] : []),
    'Tab select current · Enter open dir · Esc back',
  ];
  const headerLines = [
    'Create Session — Choose Folder',
    uriToDisplayPath(params.currentUri),
    '',
  ];
  const window = computeFolderWindow({
    displayEntries: params.entries,
    selectedIndex: params.selectedIndex,
    windowRows: computeWindowRows({
      rows: params.rows,
      headerLineCount: headerLines.length,
      footerLineCount: footerLines.length,
      reservedLineCount: 2,
      minimumRows: 5,
    }),
  });

  const bodyLines = [...headerLines];
  if (window.hasAbove) bodyLines.push('↑ more');
  for (let i = window.startIdx; i < window.endIdx; i++) {
    const entry = params.entries[i];
    if (!entry) continue;
    bodyLines.push(`${i === params.selectedIndex ? '❯' : ' '} ${entry.display}`);
  }
  if (window.hasBelow) bodyLines.push('↓ more');

  return renderScreenFrame({
    rows: params.rows,
    bodyLines,
    footerLines,
  });
}
