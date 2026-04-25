import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { TextBuffer } from '../text-buffer.js';
import { connectAhpClient } from '../protocol/connect.js';
import type { AhpClient } from '../protocol/client.js';
import { SessionClientState } from '../protocol/session-client-state.js';
import type { IAhpNotification, ISessionState, ISessionSummary } from '../protocol/types/index.js';
import { handleSessionKey } from '../views/session-key-handler.js';
import { handleSessionListKey } from '../views/session-list-key-model.js';
import { getCreateSessionAgents } from '../views/create-session-model.js';
import { handleCreateAgentKey } from '../views/create-agent-key-model.js';
import { buildFolderDisplayEntries } from '../views/folder-picker-model.js';
import { handleFolderPickerKey } from '../views/folder-picker-key-model.js';
import { buildPiTuiSessionScreen, renderPiTuiSessionFrame } from './pi-tui-session-screen.js';
import { renderCreateAgentFrame, renderFolderPickerFrame } from './create-session-screens.js';
import { paintScreenFrame } from './screen-frame.js';
import { renderSessionListFrame } from './session-list-screen.js';
import { mapKeypressToPiEvent, type KeypressLike } from './interactive-mode.js';
import { createInteractiveScaffoldState } from './pi-tui-interactive-state.js';
import { shouldDispatchInteractiveTurns } from './interactive-send-mode.js';
import { buildTurnStartedAction } from './pi-tui-dispatch.js';
import { toSingleLineTitle, looksLikeGenericTitle, firstPromptTitle } from '../views/session-title-model.js';
import { applyFetchedTurns, appendOptimisticUserTurn } from '../views/session-state-transforms.js';
import { Loader, type LoaderStyle } from './loader.js';

type ScreenMode = 'session-list' | 'create-agent' | 'create-folder' | 'session';

const DEFAULT_LOADER_STYLE: LoaderStyle = 'spinner';

export async function runPiTuiInteractiveScaffold(options?: {
  serverUrl?: string;
  tunnelToken?: string;
  tunnelAuth?: 'github' | 'microsoft';
  env?: NodeJS.ProcessEnv;
  loaderStyle?: LoaderStyle;
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
  let sessionListStatus: string | undefined;
  let openingSessionResource: string | undefined;
  const liveState = new SessionClientState();
  liveState.setClientId(clientId);
  let createProviders: string[] = [];
  let createProviderIndex = 0;
  let createFolderUri = 'file:///';
  let createFolderEntries: { name: string; display: string; isDir: boolean }[] = [];
  let createFolderIndex = 0;
  let createFolderStatus: string | undefined;
  const loaderStyle = options?.loaderStyle ?? DEFAULT_LOADER_STYLE;
  let currentLoader: Loader | undefined;
  let defaultDirectory: string | undefined;
  let preferredProvider: string | undefined;
  let client: AhpClient | undefined;
  let disconnect: (() => void) | undefined;

  startSpinner('Loading sessions…', false);
  try {
    const conn = await connectAhpClient({
      serverUrl: options?.serverUrl,
      tunnelToken: options?.tunnelToken,
      tunnelAuth: options?.tunnelAuth,
    });
    client = conn.client;
    disconnect = conn.disconnect;
    const initialized = await client.initialize(clientId, ['agenthost:/root']);
    for (const snap of initialized.snapshots) {
      liveState.handleSnapshot(snap);
    }
    defaultDirectory = initialized.defaultDirectory;
    const rootSnapshot = initialized.snapshots.find((s) => s.resource === 'agenthost:/root');
    const rootState = (rootSnapshot?.state ?? null) as import('../protocol/types/index.js').IRootState | null;
    const agents = getCreateSessionAgents(rootState);
    createProviders = agents.map((a) => a.provider);
    preferredProvider = createProviders[0];
    createFolderUri = defaultDirectory ?? createFolderUri;

    const listed = await client.listSessions();
    sessions = listed.items;

    client.on('notification', (n: IAhpNotification) => {
      if (n.method === 'action') {
        liveState.receiveEnvelope(n.params);
        const current = liveState.getSessionState(sessionState.summary.resource);
        if (current) {
          sessionState = current;
          render();
        }
        return;
      }

      if (n.method === 'notification') {
        const notif = n.params.notification;
        if (notif.type === 'notify/sessionAdded') {
          sessions = [notif.summary, ...sessions];
          render();
        }
      }
    });
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

  // Define helper functions before they're called
  function startSpinner(text: string, shouldRender: boolean = true): void {
    stopSpinner();
    currentLoader = new Loader({ 
      style: loaderStyle, 
      text,
      onFrame: () => render(),
    });
    currentLoader.start();
    // Trigger initial render to show loader (only if shouldRender is true)
    if (shouldRender) {
      render();
    }
  }

  function stopSpinner(): void {
    if (currentLoader) {
      currentLoader.stop();
      currentLoader = undefined;
    }
  }

  function getStatusWithLoader(status: string | undefined): string | undefined {
    if (!currentLoader) return status;
    return currentLoader.getFrame();
  }

  function render(): void {
    if (mode === 'session-list') {
      stdout.write(paintScreenFrame(renderSessionListFrame({
        sessions,
        selectedIndex,
        rows: stdout.rows || 24,
        statusMessage: getStatusWithLoader(sessionListStatus),
        openingSessionResource,
        spinnerIndex: currentLoader?.getFrameIndex() ?? 0,
        loading: Boolean(currentLoader) && !openingSessionResource,
      })));
    } else if (mode === 'create-agent') {
      stdout.write(paintScreenFrame(renderCreateAgentFrame({
        providers: createProviders,
        selectedIndex: createProviderIndex,
        rows: stdout.rows || 24,
        statusMessage: getStatusWithLoader(createFolderStatus),
      })));
    } else if (mode === 'create-folder') {
      stdout.write(paintScreenFrame(renderFolderPickerFrame({
        currentUri: createFolderUri,
        entries: createFolderEntries,
        selectedIndex: createFolderIndex,
        rows: stdout.rows || 24,
        statusMessage: getStatusWithLoader(createFolderStatus),
      })));
    } else {
      const preview = renderPiTuiSessionFrame({
        sessionState,
        inputBeforeCursor: buf.beforeCursor,
        inputAfterCursor: buf.afterCursor,
        scrollLineOffset,
        termCols: stdout.columns || 80,
        termRows: stdout.rows || 24,
        footerLine: 'Esc back · Ctrl+C or q to exit',
      });

      stdout.write(paintScreenFrame(preview));
    }
  }

  // Now render the initial state
  render();

  async function loadCreateFolderEntries(): Promise<void> {
    if (!client) return;
    startSpinner('Loading folders…');
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
      render();
    }
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

      openingSessionResource = summary.resource;
      startSpinner(`Opening: ${toSingleLineTitle(summary.title, 36)}…`);
      
      scrollLineOffset = 0;
      buf.clear();
      sessionState = {
        ...sessionState,
        summary,
        turns: [],
      };

      try {
        const subscribed = await client.subscribe(summary.resource);
        const snap = subscribed.snapshot;
        if (snap.resource !== summary.resource) {
          console.warn(`[el] session resource normalized: ${summary.resource} -> ${snap.resource}`);
        }

        liveState.handleSnapshot(snap);
        const fromLive = liveState.getSessionState(snap.resource);
        if (fromLive) {
          sessionState = fromLive;
        }

        const turns = await client.fetchTurns({ session: snap.resource, limit: 50 });
        sessionState = applyFetchedTurns(sessionState, turns);
        
        stopSpinner();
        openingSessionResource = undefined;
        mode = 'session';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[el] failed to open session:', msg);
        stopSpinner();
        openingSessionResource = undefined;
        sessionListStatus = `Failed to open session: ${msg}`;
      } finally {
        render();
      }
    };

    const createSelectedSession = async () => {
      if (!client) {
        mode = 'session';
        render();
        return;
      }

      const provider = createProviders[createProviderIndex] ?? preferredProvider ?? sessions[0]?.provider ?? 'copilot';
      const sessionUri = `${provider}:/${randomUUID()}`;

      startSpinner('Creating session…');
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
          stopSpinner();
          await openSelectedSession();
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[el] failed to create session:', msg);
        createFolderStatus = `Failed to create session: ${msg}`;
      } finally {
        stopSpinner();
        render();
      }
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
        const agentAction = handleCreateAgentKey({
          key: event.key,
          providerIndex: createProviderIndex,
          providerCount: createProviders.length,
        });

        if (agentAction.type === 'back') {
          mode = 'session-list';
          render();
          return;
        }
        if (agentAction.type === 'move') {
          createProviderIndex = agentAction.providerIndex;
          render();
          return;
        }
        if (agentAction.type === 'confirm') {
          mode = 'create-folder';
          createFolderIndex = 0;
          void loadCreateFolderEntries().then(() => render());
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
          loading: !!currentLoader,
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
          return;
        }
        if (action.type === 'select-current') {
          void createSelectedSession();
          return;
        }

        render();
        return;
      }

      const screen = buildPiTuiSessionScreen({
        sessionState,
        inputBeforeCursor: buf.beforeCursor,
        inputAfterCursor: buf.afterCursor,
        scrollLineOffset,
        termCols: stdout.columns || 80,
        termRows: Math.max(1, (stdout.rows || 24) - 2),
      });
      const action = handleSessionKey({
        input: event.input,
        key: event.key,
        buf,
        pendingToolCall: false,
        scrollLineOffset,
        maxScroll: 10000,
        availableLines: screen.contentRows,
      });

      if (action.type === 'back') {
        mode = 'session-list';
        render();
        return;
      }

      if (action.type === 'scroll') scrollLineOffset = action.offset;
      if (action.type === 'send') {
        const text = action.text;

        if (looksLikeGenericTitle(sessionState.summary.title)) {
          sessionState = {
            ...sessionState,
            summary: {
              ...sessionState.summary,
              title: firstPromptTitle(text),
            },
          };
        }

        if (shouldDispatch && client) {
          try {
            const optimistic = buildTurnStartedAction(sessionState.summary.resource, text);
            const clientSeq = liveState.applyOptimistic(optimistic);
            const optimisticState = liveState.getSessionState(sessionState.summary.resource);
            if (optimisticState) {
              sessionState = optimisticState;
            } else {
              sessionState = appendOptimisticUserTurn(sessionState, text);
            }
            client.dispatchAction(clientSeq, optimistic);

            const refreshDelays = [500, 1500, 3000] as const;
            for (const delay of refreshDelays) {
              setTimeout(async () => {
                try {
                  const turns = await client.fetchTurns({ session: sessionState.summary.resource, limit: 50 });
                  sessionState = applyFetchedTurns(sessionState, turns);
                  render();
                } catch {
                  // best-effort refresh
                }
              }, delay);
            }
          } catch (err) {
            console.error('[el] dispatch failed:', err instanceof Error ? err.message : String(err));
            sessionState = appendOptimisticUserTurn(sessionState, text);
          }
        } else {
          sessionState = appendOptimisticUserTurn(sessionState, text);
        }

        scrollLineOffset = 0;
      }
      render();
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}
