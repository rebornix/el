import readline from 'node:readline';
import { TextBuffer } from '../text-buffer.js';
import { acquireTunnelToken, type AuthViewState } from '../auth/tunnel-token-flow.js';
import { listAvailableTunnels, type TunnelInfo } from '../tunnel/discovery.js';
import { handleServerPromptKey } from '../views/server-prompt-key-model.js';
import { handleTunnelListKey } from '../views/tunnel-list-key-model.js';
import { type ServerPromptMode } from '../views/server-prompt-model.js';
import { mapKeypressToPiEvent, type KeypressLike } from './interactive-mode.js';
import {
  buildStartupTargetFrame,
  buildStartupTargetSpinnerUpdate,
  type StartupAuthViewState,
  type StartupTargetScreenState,
} from './startup-target-screen.js';
import { paintScreenFrame } from './screen-frame.js';
import type { TunnelAuthProvider } from '../auth/tunnel-auth.js';

interface StartupPromptOptions {
  tunnelToken?: string;
  tunnelAuth?: TunnelAuthProvider;
}

export async function promptStartupTarget(options?: StartupPromptOptions): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  let mode: ServerPromptMode | 'tunnel-list' = 'menu';
  let selectedIndex = 0;
  let error: string | undefined;
  const buf = new TextBuffer();

  let tunnels: TunnelInfo[] = [];
  let tunnelIndex = 0;
  let loadingTunnels = false;
  let spinnerIndex = 0;
  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let authView: StartupAuthViewState | undefined;
  let authStatusRow: number | undefined;
  let connectingTunnelId: string | undefined;

  const getScreenState = (): StartupTargetScreenState => ({
    mode,
    selectedIndex,
    inputBeforeCursor: buf.beforeCursor,
    inputAfterCursor: buf.afterCursor,
    error,
    tunnels,
    tunnelIndex,
    loadingTunnels,
    spinnerIndex,
    authView,
    connectingTunnelId,
  });

  const render = () => {
    const frame = buildStartupTargetFrame(getScreenState(), stdout.rows || 24, stdout.columns || 80);
    authStatusRow = frame.authStatusRow;
    stdout.write(paintScreenFrame(frame.output));
  };

  const loadTunnels = async () => {
    loadingTunnels = true;
    spinnerIndex = 0;
    if (!spinnerTimer) {
      spinnerTimer = setInterval(() => {
        spinnerIndex++;
        if (!loadingTunnels) return;
        const update = buildStartupTargetSpinnerUpdate(getScreenState(), authStatusRow);
        if (update) {
          stdout.write(update);
          return;
        }
        render();
      }, 120);
    }
    error = undefined;
    tunnels = [];
    tunnelIndex = 0;
    render();

    try {
      const token = await acquireTunnelToken(options, (nextAuthView) => {
        authView = nextAuthView;
        render();
      });
      if (!token) {
        error = 'No tunnel token available.';
        return;
      }
      tunnels = await listAvailableTunnels(token);
      if (tunnels.length === 0) {
        error = 'No tunnels available for this account.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loadingTunnels = false;
      authView = undefined;
      authStatusRow = undefined;
      if (spinnerTimer) {
        clearInterval(spinnerTimer);
        spinnerTimer = undefined;
      }
      render();
    }
  };

  return new Promise<string>((resolve, reject) => {
    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) stdin.setRawMode(true);

    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      if (stdin.isTTY) stdin.setRawMode(false);
      if (spinnerTimer) {
        clearInterval(spinnerTimer);
        spinnerTimer = undefined;
      }
    };

    const onKeypress = (str: string, key: KeypressLike) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }

      const event = mapKeypressToPiEvent(str, key);

      if (mode === 'tunnel-list') {
        const tunnelAction = handleTunnelListKey({
          key: { ...event.key, ctrl: !!event.key.ctrl },
          input: event.input,
          tunnelIndex,
          tunnelCount: tunnels.length,
          loading: loadingTunnels,
        });

        if (tunnelAction.type === 'back') {
          mode = 'menu';
          error = undefined;
          render();
          return;
        }
        if (tunnelAction.type === 'move') {
          tunnelIndex = tunnelAction.tunnelIndex;
          render();
          return;
        }
        if (tunnelAction.type === 'select') {
          const selected = tunnels[tunnelAction.tunnelIndex]!;
          const tunnelRef = selected.tunnelId || selected.name;
          cleanup();
          resolve(`tunnel://${tunnelRef}`);
          return;
        }
        return;
      }

      if (mode === 'menu' && event.key.return && selectedIndex === 0) {
        mode = 'tunnel-list';
        void loadTunnels();
        return;
      }

      const action = handleServerPromptKey({
        mode,
        selectedIndex,
        input: event.input,
        key: event.key,
        buf,
      });

      switch (action.type) {
        case 'mode':
          mode = action.mode;
          error = undefined;
          break;
        case 'select-index':
          selectedIndex = action.index;
          break;
        case 'error':
          error = action.message ?? 'Invalid URL';
          break;
        case 'input-changed':
          error = undefined;
          break;
        case 'submit':
          cleanup();
          resolve(action.url);
          return;
        case 'noop':
          break;
      }

      render();
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}

export async function resolveStartupServer(
  serverFromArgs: string | undefined,
  options?: StartupPromptOptions,
  prompt: (options?: StartupPromptOptions) => Promise<string> = promptStartupTarget,
): Promise<string> {
  return serverFromArgs ?? prompt(options);
}
