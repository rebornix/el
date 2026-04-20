import { connectAhpClient, type ConnectionOptions } from '../protocol/connect.js';
import type { IFetchTurnsResult, ISessionState, ITurn } from '../protocol/types/index.js';

export function applyFetchedTurns(state: ISessionState, turns: ITurn[]): ISessionState {
  return {
    ...state,
    turns,
  };
}

/**
 * Best-effort live bootstrap from server (read-only):
 * - connect
 * - initialize
 * - list sessions
 * - fetch recent turns from first session
 */
export async function tryBootstrapLiveSessionState(params: ConnectionOptions & {
  clientId: string;
  state: ISessionState;
}): Promise<ISessionState> {
  const { clientId, state } = params;

  let disconnect: (() => void) | undefined;

  try {
    const conn = await connectAhpClient(params);
    const client = conn.client;
    disconnect = conn.disconnect;

    await client.initialize(clientId, ['agenthost:/root']);
    const sessions = await client.listSessions();
    const first = sessions.items[0];
    if (!first?.resource) return state;

    const turns: IFetchTurnsResult = await client.fetchTurns({
      session: first.resource,
      limit: 50,
    });

    const fetched = turns.turns;

    return {
      ...applyFetchedTurns(state, fetched),
      summary: {
        ...state.summary,
        resource: first.resource,
        title: first.title || state.summary.title,
        status: first.status || state.summary.status,
      },
    };
  } catch (err) {
    console.error('[el] live bootstrap failed:', err instanceof Error ? err.message : String(err));
    return state;
  } finally {
    disconnect?.();
  }
}
