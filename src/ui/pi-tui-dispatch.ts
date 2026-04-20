import { randomUUID } from 'node:crypto';
import { connectAhpClient, type ConnectionOptions } from '../protocol/connect.js';
import { ActionType } from '../protocol/types/index.js';
import type { ISessionTurnStartedAction, URI } from '../protocol/types/index.js';

export function buildTurnStartedAction(session: URI, text: string): ISessionTurnStartedAction {
  return {
    type: ActionType.SessionTurnStarted,
    session,
    turnId: randomUUID(),
    userMessage: { text },
  };
}

export async function dispatchInteractiveTurn(params: ConnectionOptions & {
  session: URI;
  text: string;
  clientId: string;
}): Promise<boolean> {
  const { session, text, clientId } = params;

  let disconnect: (() => void) | undefined;

  try {
    const conn = await connectAhpClient(params);
    const client = conn.client;
    disconnect = conn.disconnect;

    await client.initialize(clientId, ['agenthost:/root']);
    const action = buildTurnStartedAction(session, text);
    client.dispatchAction(Date.now(), action);
    return true;
  } catch (err) {
    console.error('[el] dispatch failed:', err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    disconnect?.();
  }
}
