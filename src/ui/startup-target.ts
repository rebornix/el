import readline from 'node:readline';
import { TextBuffer } from '../text-buffer.js';
import {
  cacheToken,
  getToken,
  startDeviceCodeFlow,
  pollForDeviceCodeToken,
  type TunnelAuthProvider,
  type TunnelAuthToken,
} from '../auth/tunnel-auth.js';
import { listAvailableTunnels, type TunnelInfo } from '../tunnel/discovery.js';
import { handleServerPromptKey } from '../views/server-prompt-key-model.js';
import { type ServerPromptMode } from '../views/server-prompt-model.js';
import { mapKeypressToPiEvent, type KeypressLike } from './interactive-mode.js';
import {
  buildStartupTargetFrame,
  buildStartupTargetSpinnerUpdate,
  type StartupAuthViewState,
  type StartupTargetScreenState,
} from './startup-target-screen.js';

interface StartupPromptOptions {
  tunnelToken?: string;
  tunnelAuth?: TunnelAuthProvider;
}

async function acquireTunnelToken(
  options?: StartupPromptOptions,
  onAuthView?: (view: StartupAuthViewState | undefined) => void,
): Promise<TunnelAuthToken | null> {
  const provider = options?.tunnelAuth ?? 'github';
  const token = await getToken({ provider, manualToken: options?.tunnelToken });
  if (token || provider !== 'github') return token;

  const device = await startDeviceCodeFlow();
  const authView: StartupAuthViewState = {
    title: 'Authorize tunnel access',
    lines: [
      `1) Open: ${device.verification_uri}`,
      `2) Enter code: ${device.user_code}`,
    ],
    statusMessage: 'Waiting for authorization...',
  };

  if (onAuthView) {
    onAuthView(authView);
  } else {
    process.stdout.write(`\n${authView.title}:\n`);
    for (const line of authView.lines) {
      process.stdout.write(`${line}\n`);
    }
    process.stdout.write('\n');
  }

  const accessToken = await pollForDeviceCodeToken(
    device.device_code,
    device.interval,
    device.expires_in,
  );

  const resolved: TunnelAuthToken = {
    token: accessToken,
    provider,
  };
  await cacheToken(resolved);
  return resolved;
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
  });

  const render = () => {
    const frame = buildStartupTargetFrame(getScreenState());
    authStatusRow = frame.authStatusRow;
    stdout.write(frame.output);
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
        if (event.key.escape) {
          mode = 'menu';
          error = undefined;
          render();
          return;
        }

        if (loadingTunnels) {
          return;
        }

        if (event.key.upArrow || (event.key.ctrl && event.input === 'p')) {
          tunnelIndex = Math.max(0, tunnelIndex - 1);
          render();
          return;
        }

        if (event.key.downArrow || (event.key.ctrl && event.input === 'n')) {
          tunnelIndex = Math.min(Math.max(0, tunnels.length - 1), tunnelIndex + 1);
          render();
          return;
        }

        if (event.key.return && tunnels.length > 0) {
          const selected = tunnels[tunnelIndex]!;
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
