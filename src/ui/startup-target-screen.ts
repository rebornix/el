import type { TunnelInfo } from '../tunnel/discovery.js';
import { MENU_OPTIONS, type ServerPromptMode } from '../views/server-prompt-model.js';

const CLEAR_SCREEN = '\x1b[2J\x1b[H';
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
}

interface StartupTargetFrame {
  output: string;
  authStatusRow?: number;
}

function spinnerFrame(index: number): string {
  return SPINNER_FRAMES[index % SPINNER_FRAMES.length]!;
}

export function buildStartupTargetFrame(state: StartupTargetScreenState): StartupTargetFrame {
  const lines: string[] = [];

  if (state.mode === 'tunnel-list') {
    lines.push('Connect via Dev Tunnel', '');

    if (state.loadingTunnels) {
      if (state.authView) {
        lines.push(state.authView.title, ...state.authView.lines, '');
        lines.push(`${spinnerFrame(state.spinnerIndex)} ${state.authView.statusMessage}`);
        const authStatusRow = lines.length;
        lines.push('', 'Esc back');
        return { output: CLEAR_SCREEN + lines.join('\n'), authStatusRow };
      }

      lines.push(`${spinnerFrame(state.spinnerIndex)} Loading tunnels...`, '', 'Esc back');
      return { output: CLEAR_SCREEN + lines.join('\n') };
    }

    if (state.tunnels.length === 0) {
      lines.push('No tunnels found.');
      if (state.error) lines.push(state.error);
      lines.push('', 'Esc back');
      return { output: CLEAR_SCREEN + lines.join('\n') };
    }

    for (let i = 0; i < state.tunnels.length; i++) {
      const tunnel = state.tunnels[i]!;
      const marker = i === state.tunnelIndex ? '❯' : ' ';
      const online = tunnel.online ? '●' : '○';
      const id = tunnel.name || tunnel.tunnelId;
      lines.push(`${marker} ${online} ${id}`);
    }
    lines.push('', '↑/↓ select · Enter confirm · Esc back');
    return { output: CLEAR_SCREEN + lines.join('\n') };
  }

  lines.push('Connect to AHP server', '');

  if (state.mode === 'menu') {
    MENU_OPTIONS.forEach((opt, idx) => {
      lines.push(`${idx === state.selectedIndex ? '❯' : ' '} ${opt.label}`);
    });
    lines.push('', '↑/↓ select · Enter confirm');
    return { output: CLEAR_SCREEN + lines.join('\n') };
  }

  lines.push(
    'Server URL (ws:// or wss://)',
    `> ${state.inputBeforeCursor}▊${state.inputAfterCursor}`,
  );
  if (state.error) lines.push(state.error);
  lines.push('', 'Enter submit · Esc back');
  return { output: CLEAR_SCREEN + lines.join('\n') };
}

export function buildStartupTargetSpinnerUpdate(
  state: StartupTargetScreenState,
  authStatusRow: number | undefined,
): string | null {
  if (!state.loadingTunnels || state.mode !== 'tunnel-list' || !state.authView || !authStatusRow) {
    return null;
  }

  return `\x1b[${authStatusRow};1H${CLEAR_LINE}${spinnerFrame(state.spinnerIndex)} ${state.authView.statusMessage}`;
}
