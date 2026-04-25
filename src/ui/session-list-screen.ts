import type { ISessionSummary } from '../protocol/types/index.js';
import { SessionStatus } from '../protocol/types/index.js';
import { computeSessionListWindow } from '../views/session-list-model.js';
import { uriToDisplayPath } from '../uri-helpers.js';
import { computeWindowRows, renderScreenFrame } from './screen-frame.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

function spinnerFrame(index: number): string {
  return SPINNER_FRAMES[index % SPINNER_FRAMES.length]!;
}

function toSingleLineTitle(raw: string | undefined, max = 72): string {
  const base = (raw ?? '(untitled)')
    .replace(/<attachment[\s\S]*?<\/attachment>/gi, ' ')
    .replace(/<attachments?>|<\/attachments?>/gi, ' ')
    .replace(/<reminder>[\s\S]*?<\/reminder>/gi, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*•]\s+/, '');

  if (base.length <= max) return base;
  return `${base.slice(0, Math.max(1, max - 1))}…`;
}

function folderNameFromSummary(s: ISessionSummary, max = 20): string {
  const wd = s.workingDirectory;
  if (!wd) return 'no-folder';
  const path = uriToDisplayPath(wd);
  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1] ?? '/';
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}

export function renderSessionListFrame(params: {
  sessions: ISessionSummary[];
  selectedIndex: number;
  rows: number;
  statusMessage?: string;
  openingSessionResource?: string;
  spinnerIndex?: number;
  loading?: boolean;
  loadingText?: string;
}): string {
  const { sessions, selectedIndex, rows, statusMessage, openingSessionResource, spinnerIndex = 0, loading, loadingText } = params;

  // Show loading state in-place
  if (loading) {
    const bodyLines = [
      'Sessions',
      '',
      `${spinnerFrame(spinnerIndex)} ${loadingText || 'Loading sessions…'}`,
    ];
    return renderScreenFrame({
      rows,
      bodyLines,
      footerLines: ['Esc back'],
    });
  }

  // Show opening state when a session is being opened
  if (openingSessionResource) {
    const session = sessions.find(s => s.resource === openingSessionResource);
    const sessionTitle = session ? toSingleLineTitle(session.title, 36) : openingSessionResource;
    const bodyLines = [
      'Sessions',
      '',
      `${spinnerFrame(spinnerIndex)} Opening ${sessionTitle}…`,
    ];
    return renderScreenFrame({
      rows,
      bodyLines,
      footerLines: ['Esc back'],
    });
  }

  const headerLines = ['Sessions', ''];
  const footerLines = [
    ...(statusMessage ? [statusMessage] : []),
    '↑/↓ select · Enter open · q quit',
  ];
  const window = computeSessionListWindow({
    sessions,
    rootState: null,
    selectedIndex,
    terminalRows: rows,
    hasStatus: Boolean(statusMessage),
    windowRows: computeWindowRows({
      rows,
      headerLineCount: headerLines.length,
      footerLineCount: footerLines.length,
      reservedLineCount: 2,
      minimumRows: 5,
    }),
  });

  const providers = new Set(sessions.map(s => s.provider).filter(Boolean));
  const showProvider = providers.size > 1;

  const items: Array<{ label: string }> = [
    { label: '+ Create new session' },
    ...sessions.map((s) => {
      const active = (s.status & SessionStatus.InProgress) === SessionStatus.InProgress;
      const title = toSingleLineTitle(s.title, 44);
      const folder = folderNameFromSummary(s);
      const suffix = showProvider ? `  [${folder}] (${s.provider || 'unknown'})` : `  [${folder}]`;
      return { label: `${active ? '◉' : '○'} ${title}${suffix}` };
    }),
  ];

  const lines: string[] = [...headerLines];
  if (window.hasAbove) lines.push('↑ more');
  for (let i = window.startIdx; i < window.endIdx; i++) {
    const item = items[i];
    if (!item) continue;
    lines.push(`${i === selectedIndex ? '❯' : ' '} ${item.label}`);
  }
  if (window.hasBelow) lines.push('↓ more');

  return renderScreenFrame({
    rows,
    bodyLines: lines,
    footerLines,
  });
}
