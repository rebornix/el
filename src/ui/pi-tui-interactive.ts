import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { TextBuffer } from '../text-buffer.js';
import { connectAhpClient } from '../protocol/connect.js';
import type { AhpClient } from '../protocol/client.js';
import type { IFetchTurnsResult, ISessionState, ISessionSummary } from '../protocol/types/index.js';
import { SessionStatus } from '../protocol/types/index.js';
import { handleSessionKey } from '../views/session-key-handler.js';
import { handleSessionListKey } from '../views/session-list-key-model.js';
import { computeSessionListWindow } from '../views/session-list-model.js';
import { getCreateSessionAgents, nextCreateSessionIndex } from '../views/create-session-model.js';
import { buildFolderDisplayEntries, computeFolderWindow } from '../views/folder-picker-model.js';
import { handleFolderPickerKey } from '../views/folder-picker-key-model.js';
import { uriToDisplayPath } from '../uri-helpers.js';
import { renderPiTuiPreview } from './pi-tui-preview.js';
import { mapKeypressToPiEvent, type KeypressLike } from './interactive-mode.js';
import { createInteractiveScaffoldState, appendScaffoldTurn } from './pi-tui-interactive-state.js';
import { shouldDispatchInteractiveTurns } from './interactive-send-mode.js';
import { buildTurnStartedAction } from './pi-tui-dispatch.js';

type ScreenMode = 'session-list' | 'create-agent' | 'create-folder' | 'session';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

function applyFetchedTurns(state: ISessionState, turns: IFetchTurnsResult): ISessionState {
  return {
    ...state,
    turns: turns.turns,
  };
}

function toSingleLineTitle(raw: string | undefined, max = 72): string {
  const base = (raw ?? '(untitled)')
    .replace(/<attachment[\s\S]*?<\/attachment>/gi, ' ')
    .replace(/<attachments?>|<\/attachments?>/gi, ' ')
    .replace(/<reminder>[\s\S]*?<\/reminder>/gi, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (base.length <= max) return base;
  return `${base.slice(0, Math.max(1, max - 1))}…`;
}

function looksLikeGenericTitle(title: string | undefined): boolean {
  if (!title) return true;
  const t = title.trim();
  if (!t) return true;
  if (/^session$/i.test(t)) return true;
  if (/^[a-z]+:\/\//i.test(t) || /^[a-z]+:\//i.test(t)) return true;
  return false;
}

function firstPromptTitle(text: string, max = 64): string {
  const oneLine = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!oneLine) return 'New session';
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function folderNameFromSummary(s: ISessionSummary): string {
  const wd = s.workingDirectory;
  if (!wd) return 'no-folder';
  const path = uriToDisplayPath(wd);
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '/';
}

function renderCreateAgentScreen(params: {
  providers: string[];
  selectedIndex: number;
  statusMessage?: string;
}): string {
  const out: string[] = [];
  out.push('Create Session — Choose Agent');
  out.push('');

  if (params.providers.length === 0) {
    out.push('No agents available');
  } else {
    params.providers.forEach((p, idx) => {
      out.push(`${idx === params.selectedIndex ? '❯' : ' '} ${p}`);
    });
  }

  out.push('');
  if (params.statusMessage) out.push(params.statusMessage);
  out.push('↑/↓ select · Enter next · Esc back');
  return out.join('\n');
}

function renderFolderPickerScreen(params: {
  currentUri: string;
  entries: { name: string; display: string; isDir: boolean }[];
  selectedIndex: number;
  rows: number;
  statusMessage?: string;
}): string {
  const out: string[] = [];
  out.push('Create Session — Choose Folder');
  out.push(uriToDisplayPath(params.currentUri));
  out.push('');

  const window = computeFolderWindow({
    displayEntries: params.entries,
    selectedIndex: params.selectedIndex,
    maxHeight: params.rows,
  });

  if (window.hasAbove) out.push('↑ more');
  for (let i = window.startIdx; i < window.endIdx; i++) {
    const e = params.entries[i];
    if (!e) continue;
    out.push(`${i === params.selectedIndex ? '❯' : ' '} ${e.display}`);
  }
  if (window.hasBelow) out.push('↓ more');

  out.push('');
  if (params.statusMessage) out.push(params.statusMessage);
  out.push('Tab select current · Enter open dir · Esc back');
  return out.join('\n');
}

function renderSessionListScreen(params: {
  sessions: ISessionSummary[];
  selectedIndex: number;
  rows: number;
  statusMessage?: string;
}): string {
  const { sessions, selectedIndex, rows, statusMessage } = params;
  const window = computeSessionListWindow({
    sessions,
    rootState: null,
    selectedIndex,
    terminalRows: rows,
  });

  const out: string[] = [];
  out.push('Sessions');
  out.push('');

  const items: Array<{ label: string }> = [
    { label: 'Create new session' },
    ...sessions.map((s) => {
      const active = (s.status & SessionStatus.InProgress) === SessionStatus.InProgress;
      const title = toSingleLineTitle(s.title, 44);
      const folder = folderNameFromSummary(s);
      const provider = s.provider || 'unknown';
      return { label: `${active ? '◉' : '○'} ${title}  [${folder}] (${provider})` };
    }),
  ];

  if (window.hasAbove) out.push('↑ more');

  for (let i = window.startIdx; i < window.endIdx; i++) {
    const item = items[i];
    if (!item) continue;
    out.push(`${i === selectedIndex ? '❯' : ' '} ${item.label}`);
  }

  if (window.hasBelow) out.push('↓ more');

  out.push('');
  if (statusMessage) out.push(statusMessage);
  out.push('↑/↓ select · Enter open · q quit');
  return out.join('\n');
}

export async function runPiTuiInteractiveScaffold(options?: {
  serverUrl?: string;
  tunnelToken?: string;
  tunnelAuth?: 'github' | 'microsoft';
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const stdin = process.stdin;
  const stdout = process.stdout;
  const buf = new TextBuffer();
  const env = options?.env ?? process.env;
  const clientId = `el-pi-${Date.now()}`;
  const shouldDispatch = shouldDispatchInteractiveTurns(env);

  let mode: ScreenMode = 'session-list';
  let selectedIndex = 0;
  let scrollLineOffset = 0;
  let sessionState = createInteractiveScaffoldState();
  let sessions: ISessionSummary[] = [];
  let sessionListStatus: string | undefined = 'Loading sessions…';
  let createProviders: string[] = [];
  let createProviderIndex = 0;
  let createFolderUri = 'file:///';
  let createFolderEntries: { name: string; display: string; isDir: boolean }[] = [];
  let createFolderIndex = 0;
  let createFolderStatus: string | undefined;
  let spinnerIndex = 0;
  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let defaultDirectory: string | undefined;
  let preferredProvider: string | undefined;
  let client: AhpClient | undefined;
  let disconnect: (() => void) | undefined;

  startSpinner();
  try {
    const conn = await connectAhpClient({
      serverUrl: options?.serverUrl,
      tunnelToken: options?.tunnelToken,
      tunnelAuth: options?.tunnelAuth,
    });
    client = conn.client;
    disconnect = conn.disconnect;
    const initialized = await client.initialize(clientId, ['agenthost:/root']);
    defaultDirectory = initialized.defaultDirectory;
    const rootSnapshot = initialized.snapshots.find((s) => s.resource === 'agenthost:/root');
    const rootState = (rootSnapshot?.state ?? null) as import('../protocol/types/index.js').IRootState | null;
    const agents = getCreateSessionAgents(rootState);
    createProviders = agents.map((a) => a.provider);
    preferredProvider = createProviders[0];
    createFolderUri = defaultDirectory ?? createFolderUri;

    const listed = await client.listSessions();
    sessions = listed.items;
    if (createProviders.length === 0) {
      createProviders = Array.from(new Set(sessions.map((s) => s.provider).filter(Boolean)));
    }
    sessionListStatus = sessions.length === 0 ? 'No sessions yet. Select "Create new session".' : undefined;
    selectedIndex = sessions.length > 0 ? 1 : 0;
    if (!preferredProvider) {
      preferredProvider = sessions[0]?.provider;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[el] session list unavailable:', msg);
    sessionListStatus = `Failed to load sessions: ${msg}`;
    selectedIndex = 0;
  } finally {
    stopSpinner();
  }

  async function loadCreateFolderEntries(): Promise<void> {
    if (!client) return;
    createFolderStatus = 'Loading folders…';
    startSpinner();
    render();
    try {
      const listed = await client.resourceList(createFolderUri as import('../protocol/types/index.js').URI);
      createFolderEntries = buildFolderDisplayEntries(listed.entries);
      createFolderIndex = Math.min(createFolderIndex, Math.max(0, createFolderEntries.length - 1));
      createFolderStatus = undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      createFolderEntries = [{ name: '..', display: '..', isDir: true }];
      createFolderIndex = 0;
      createFolderStatus = `Failed to load folder: ${msg}`;
    } finally {
      stopSpinner();
    }
  }

  function startSpinner(): void {
    if (spinnerTimer) return;
    spinnerTimer = setInterval(() => {
      spinnerIndex++;
      render();
    }, 120);
  }

  function stopSpinner(): void {
    if (!spinnerTimer) return;
    clearInterval(spinnerTimer);
    spinnerTimer = undefined;
  }

  function render(): void {
    stdout.write('\x1b[2J\x1b[H');

    if (mode === 'session-list') {
      const spinner = spinnerTimer ? `${SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]} ` : '';
      stdout.write(renderSessionListScreen({
        sessions,
        selectedIndex,
        rows: stdout.rows || 24,
        statusMessage: sessionListStatus ? `${spinner}${sessionListStatus}` : undefined,
      }));
      stdout.write('\n');
      return;
    }

    if (mode === 'create-agent') {
      const spinner = spinnerTimer ? `${SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]} ` : '';
      stdout.write(renderCreateAgentScreen({
        providers: createProviders,
        selectedIndex: createProviderIndex,
        statusMessage: createFolderStatus ? `${spinner}${createFolderStatus}` : undefined,
      }));
      stdout.write('\n');
      return;
    }

    if (mode === 'create-folder') {
      const spinner = spinnerTimer ? `${SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]} ` : '';
      stdout.write(renderFolderPickerScreen({
        currentUri: createFolderUri,
        entries: createFolderEntries,
        selectedIndex: createFolderIndex,
        rows: stdout.rows || 24,
        statusMessage: createFolderStatus ? `${spinner}${createFolderStatus}` : undefined,
      }));
      stdout.write('\n');
      return;
    }

    const preview = renderPiTuiPreview({
      sessionState,
      inputBeforeCursor: buf.beforeCursor,
      inputAfterCursor: buf.afterCursor,
      scrollLineOffset,
      termCols: stdout.columns || 80,
      termRows: stdout.rows || 24,
      debugHeader: false,
    });

    stdout.write(preview + '\n');
    stdout.write('\nEsc back · Ctrl+C or q to exit\n');
  }

  return new Promise<void>((resolve) => {
    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) stdin.setRawMode(true);

    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      if (stdin.isTTY) stdin.setRawMode(false);
      stopSpinner();
      disconnect?.();
      resolve();
    };

    const openSelectedSession = async () => {
      if (!client) {
        mode = 'session';
        render();
        return;
      }
      const summary = sessions[selectedIndex - 1];
      if (!summary) return;

      sessionListStatus = `Opening: ${toSingleLineTitle(summary.title, 36)}...`;
      startSpinner();
      mode = 'session';
      scrollLineOffset = 0;
      buf.clear();
      sessionState = {
        ...sessionState,
        summary,
        turns: [],
      };
      render();

      try {
        const subscribed = await client.subscribe(summary.resource);
        const snap = subscribed.snapshot;
        if (snap.resource !== summary.resource) {
          console.warn(`[el] session resource normalized: ${summary.resource} -> ${snap.resource}`);
        }

        const snapState = snap.state as Partial<ISessionState>;
        if (snapState && snapState.summary && Array.isArray(snapState.turns)) {
          sessionState = {
            ...sessionState,
            ...snapState,
            summary: snapState.summary as ISessionSummary,
            turns: snapState.turns,
          } as ISessionState;
        }

        const turns = await client.fetchTurns({ session: snap.resource, limit: 50 });
        sessionState = applyFetchedTurns(
          {
            ...sessionState,
            summary: (snapState.summary as ISessionSummary) ?? summary,
          },
          turns,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[el] failed to open session:', msg);
        mode = 'session-list';
        sessionListStatus = `Failed to open session: ${msg}`;
      } finally {
        stopSpinner();
      }
      render();
    };

    const createSelectedSession = async () => {
      if (!client) {
        mode = 'session';
        render();
        return;
      }

      const provider = createProviders[createProviderIndex] ?? preferredProvider ?? sessions[0]?.provider ?? 'copilot';
      const sessionUri = `${provider}:/${randomUUID()}`;

      createFolderStatus = 'Creating session...';
      startSpinner();
      try {
        await client.createSession({
          session: sessionUri,
          provider,
          workingDirectory: createFolderUri || defaultDirectory,
        });

        const listed = await client.listSessions();
        sessions = listed.items;
        sessionListStatus = sessions.length === 0 ? 'No sessions yet. Select "Create new session".' : undefined;
        const createdIdx = sessions.findIndex((s) => s.resource === sessionUri);
        selectedIndex = createdIdx >= 0 ? createdIdx + 1 : (sessions.length > 0 ? sessions.length : 0);
        mode = 'session-list';
        createFolderStatus = undefined;

        if (selectedIndex > 0) {
          await openSelectedSession();
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[el] failed to create session:', msg);
        createFolderStatus = `Failed to create session: ${msg}`;
      } finally {
        stopSpinner();
      }
      render();
    };

    const onKeypress = (str: string, key: KeypressLike) => {
      if ((key.ctrl && key.name === 'c') || str === 'q') {
        cleanup();
        return;
      }

      const event = mapKeypressToPiEvent(str, key);

      if (mode === 'session-list') {
        const totalItems = sessions.length + 1;
        selectedIndex = Math.max(0, Math.min(selectedIndex, totalItems - 1));

        const action = handleSessionListKey({
          key: event.key,
          selectedIndex,
          totalItems,
        });

        if (action.type === 'move') {
          selectedIndex = action.selectedIndex;
          render();
          return;
        }

        if (action.type === 'create') {
          createProviderIndex = 0;
          createFolderUri = defaultDirectory ?? createFolderUri;
          createFolderStatus = undefined;
          mode = 'create-agent';
          render();
          return;
        }

        if (action.type === 'select') {
          void openSelectedSession();
          return;
        }

        render();
        return;
      }

      if (mode === 'create-agent') {
        if (event.key.escape) {
          mode = 'session-list';
          render();
          return;
        }
        if (event.key.upArrow) {
          createProviderIndex = nextCreateSessionIndex(createProviderIndex, 'up', createProviders.length);
          render();
          return;
        }
        if (event.key.downArrow) {
          createProviderIndex = nextCreateSessionIndex(createProviderIndex, 'down', createProviders.length);
          render();
          return;
        }
        if (event.key.return) {
          mode = 'create-folder';
          createFolderIndex = 0;
          void loadCreateFolderEntries().then(() => render());
          render();
          return;
        }
        render();
        return;
      }

      if (mode === 'create-folder') {
        const dirs = createFolderEntries.filter((e) => e.isDir && e.name !== '..').map((e) => ({ name: e.name }));
        const action = handleFolderPickerKey({
          key: event.key,
          selectedIdx: createFolderIndex,
          totalEntries: Math.max(1, createFolderEntries.length),
          loading: !!spinnerTimer,
          currentUri: createFolderUri as import('../protocol/types/index.js').URI,
          sortedDirs: dirs,
        });

        if (action.type === 'back') {
          mode = 'create-agent';
          render();
          return;
        }
        if (action.type === 'move') {
          createFolderIndex = action.selectedIndex;
          render();
          return;
        }
        if (action.type === 'navigate') {
          createFolderUri = action.uri;
          createFolderIndex = 0;
          void loadCreateFolderEntries().then(() => render());
          render();
          return;
        }
        if (action.type === 'select-current') {
          void createSelectedSession();
          return;
        }

        render();
        return;
      }

      const action = handleSessionKey({
        input: event.input,
        key: event.key,
        buf,
        pendingToolCall: false,
        scrollLineOffset,
        maxScroll: 10000,
        availableLines: Math.max(10, (stdout.rows || 24) - 10),
      });

      if (action.type === 'back') {
        mode = 'session-list';
        render();
        return;
      }

      if (action.type === 'scroll') scrollLineOffset = action.offset;
      if (action.type === 'send') {
        const text = action.text;

        if (shouldDispatch && client) {
          try {
            if (looksLikeGenericTitle(sessionState.summary.title)) {
              sessionState = {
                ...sessionState,
                summary: {
                  ...sessionState.summary,
                  title: firstPromptTitle(text),
                },
              };
            }

            const optimistic = buildTurnStartedAction(sessionState.summary.resource, text);
            client.dispatchAction(Date.now(), optimistic);

            // Refresh turns shortly after dispatch to show real server response.
            void (async () => {
              try {
                const turns = await client!.fetchTurns({ session: sessionState.summary.resource, limit: 50 });
                sessionState = applyFetchedTurns(sessionState, turns);
                render();
              } catch (err) {
                console.error('[el] refresh after send failed:', err instanceof Error ? err.message : String(err));
              }
            })();
          } catch (err) {
            console.error('[el] dispatch failed:', err instanceof Error ? err.message : String(err));
            sessionState = appendScaffoldTurn(sessionState, text);
          }
        } else {
          sessionState = appendScaffoldTurn(sessionState, text);
        }

        scrollLineOffset = 0;
      }
      render();
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}
