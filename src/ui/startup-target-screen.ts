import type { TunnelInfo } from '../tunnel/discovery.js';
import { MENU_OPTIONS, type ServerPromptMode } from '../views/server-prompt-model.js';
import { computeSelectionWindow } from '../views/selection-window.js';
import { computeWindowRows, renderScreenFrame } from './screen-frame.js';
import { bannerLines } from './banner.js';

const CLEAR_LINE = '\x1b[2K';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

export interface StartupAuthViewState {
  title: string;
  lines: string[];
  statusMessage: string;
}

export interface StartupTargetScreenState {
  mode: ServerPromptMode | 'tunnel-list';
  selectedIndex: number;
  inputBeforeCursor: string;
  inputAfterCursor: string;
  error?: string;
  tunnels: TunnelInfo[];
  tunnelIndex: number;
  loadingTunnels: boolean;
  spinnerIndex: number;
  authView?: StartupAuthViewState;
  connectingTunnelId?: string;
}

interface StartupTargetFrame {
  output: string;
  authStatusRow?: number;
}

function spinnerFrame(index: number): string {
  return SPINNER_FRAMES[index % SPINNER_FRAMES.length]!;
}

export function buildStartupTargetFrame(
  state: StartupTargetScreenState,
  rows: number,
): StartupTargetFrame {
  if (state.mode === 'tunnel-list') {
    // Show connecting state when a tunnel is being connected
    if (state.connectingTunnelId) {
      const tunnel = state.tunnels.find(t => (t.tunnelId || t.name) === state.connectingTunnelId);
      const tunnelName = tunnel?.name || state.connectingTunnelId;
      const bodyLines = [
        'Connect via Dev Tunnel',
        '',
        `${spinnerFrame(state.spinnerIndex)} Connecting to ${tunnelName}…`,
      ];
      return {
        output: renderScreenFrame({ rows, bodyLines, footerLines: ['Esc back'] }),
      };
    }

    const headerLines = ['Connect via Dev Tunnel', ''];

    if (state.loadingTunnels) {
      if (state.authView) {
        const bodyLines = [
          ...headerLines,
          state.authView.title,
          ...state.authView.lines,
          '',
          `${spinnerFrame(state.spinnerIndex)} ${state.authView.statusMessage}`,
        ];
        return {
          output: renderScreenFrame({ rows, bodyLines, footerLines: ['Esc back'] }),
        };
      }

      const bodyLines = [
        'Connect via Dev Tunnel',
        '',
        `${spinnerFrame(state.spinnerIndex)} Loading tunnels…`,
      ];
      return {
        output: renderScreenFrame({ rows, bodyLines, footerLines: ['Esc back'] }),
      };
    }

    const footerLines = [state.tunnels.length > 0 ? '↑/↓ select · Enter confirm · Esc back' : 'Esc back'];
    const bodyLines = [...headerLines];

    if (state.tunnels.length === 0) {
      bodyLines.push('No tunnels found.');
      if (state.error) bodyLines.push(state.error);
      return {
        output: renderScreenFrame({ rows, bodyLines, footerLines }),
      };
    }

    const window = computeSelectionWindow({
      totalItems: state.tunnels.length,
      selectedIndex: state.tunnelIndex,
      windowSize: computeWindowRows({
        rows,
        headerLineCount: headerLines.length,
        footerLineCount: footerLines.length,
        reservedLineCount: 2,
        minimumRows: 5,
      }),
    });

    if (window.hasAbove) bodyLines.push('↑ more');
    for (let i = window.startIdx; i < window.endIdx; i++) {
      const tunnel = state.tunnels[i];
      if (!tunnel) continue;
      const marker = i === state.tunnelIndex ? '❯' : ' ';
      const online = tunnel.online ? '●' : '○';
      const id = tunnel.name || tunnel.tunnelId;
      bodyLines.push(`${marker} ${online} ${id}`);
    }
    if (window.hasBelow) bodyLines.push('↓ more');

    return {
      output: renderScreenFrame({ rows, bodyLines, footerLines }),
    };
  }

  if (state.mode === 'menu') {
    const headerLines = [...bannerLines(), ''];
    const footerLines = ['↑/↓ select · Enter confirm'];
    const window = computeSelectionWindow({
      totalItems: MENU_OPTIONS.length,
      selectedIndex: state.selectedIndex,
      windowSize: computeWindowRows({
        rows,
        headerLineCount: headerLines.length,
        footerLineCount: footerLines.length,
        reservedLineCount: 2,
        minimumRows: 2,
      }),
    });

    const bodyLines = [...headerLines];
    if (window.hasAbove) bodyLines.push('↑ more');
    for (let i = window.startIdx; i < window.endIdx; i++) {
      const option = MENU_OPTIONS[i];
      if (!option) continue;
      bodyLines.push(`${i === state.selectedIndex ? '❯' : ' '} ${option.label}`);
    }
    if (window.hasBelow) bodyLines.push('↓ more');

    return {
      output: renderScreenFrame({ rows, bodyLines, footerLines }),
    };
  }

  return {
    output: renderScreenFrame({
      rows,
      bodyLines: [
        'Connect to AHP server',
        '',
        'Server URL (ws:// or wss://)',
        `> ${state.inputBeforeCursor}▊${state.inputAfterCursor}`,
        ...(state.error ? [state.error] : []),
      ],
      footerLines: ['Enter submit · Esc back'],
    }),
  };
}

export function renderStartupTargetScreen(
  state: StartupTargetScreenState,
  rows: number,
): string {
  return buildStartupTargetFrame(state, rows).output;
}

export function buildStartupTargetSpinnerUpdate(
  state: StartupTargetScreenState,
  authStatusRow: number | undefined,
): string | null {
  // Spinner is now part of footer, no need for incremental updates
  return null;
}
