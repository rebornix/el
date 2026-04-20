import {
  ResponsePartKind,
  SessionLifecycle,
  SessionStatus,
  TurnState,
  type ISessionState,
  type ITurn,
} from '../protocol/types/index.js';

export function createInteractiveScaffoldState(): ISessionState {
  const now = Date.now();
  return {
    summary: {
      resource: 'session:pi-scaffold',
      provider: 'pi-tui',
      title: 'pi-tui session',
      status: SessionStatus.Idle,
      createdAt: now,
      modifiedAt: now,
      model: { id: 'pi-tui' },
    },
    lifecycle: SessionLifecycle.Ready,
    turns: [],
    queuedMessages: [],
  };
}

export function appendScaffoldTurn(state: ISessionState, text: string): ISessionState {
  const turnId = `turn-${state.turns.length + 1}`;
  const nextTurn: ITurn = {
    id: turnId,
    state: TurnState.Complete,
    userMessage: { text },
    responseParts: [
      {
        kind: ResponsePartKind.Markdown,
        id: `${turnId}-echo`,
        content: `Echo: ${text}`,
      },
    ],
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
