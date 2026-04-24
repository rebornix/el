/**
 * Pure state transforms for session data.
 */
import { TurnState, type ISessionState, type IFetchTurnsResult, type ITurn } from '../protocol/types/index.js';

export function applyFetchedTurns(state: ISessionState, turns: IFetchTurnsResult): ISessionState {
  return {
    ...state,
    turns: turns.turns,
  };
}

export function appendOptimisticUserTurn(state: ISessionState, text: string): ISessionState {
  const nextTurn: ITurn = {
    id: `local-${Date.now()}`,
    state: TurnState.Complete,
    userMessage: { text },
    responseParts: [],
    usage: undefined,
  };

  return {
    ...state,
    turns: [...state.turns, nextTurn],
    summary: {
      ...state.summary,
      modifiedAt: Date.now(),
    },
  };
}
