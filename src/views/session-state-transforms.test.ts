import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SessionLifecycle,
  SessionStatus,
  TurnState,
  type ISessionState,
  type IFetchTurnsResult,
  type ITurn,
} from '../protocol/types/index.js';
import { applyFetchedTurns, appendOptimisticUserTurn } from './session-state-transforms.js';

function makeSessionState(turns: ITurn[] = []): ISessionState {
  return {
    summary: {
      resource: 'test:/session-1',
      provider: 'test',
      title: 'Test session',
      status: SessionStatus.Idle,
      createdAt: 1000,
      modifiedAt: 1000,
      model: { id: 'test-model' },
    },
    lifecycle: SessionLifecycle.Ready,
    turns,
    queuedMessages: [],
  };
}

describe('applyFetchedTurns', () => {
  it('replaces turns with fetched result', () => {
    const existing: ITurn = {
      id: 'old-1',
      state: TurnState.Complete,
      userMessage: { text: 'old' },
      responseParts: [],
      usage: undefined,
    };
    const state = makeSessionState([existing]);
    const fetched: IFetchTurnsResult = {
      turns: [
        {
          id: 'new-1',
          state: TurnState.Complete,
          userMessage: { text: 'new' },
          responseParts: [],
          usage: undefined,
        },
        {
          id: 'new-2',
          state: TurnState.Complete,
          userMessage: { text: 'new2' },
          responseParts: [],
          usage: undefined,
        },
      ],
      hasMore: false,
    };

    const result = applyFetchedTurns(state, fetched);
    assert.equal(result.turns.length, 2);
    assert.equal(result.turns[0]!.id, 'new-1');
    assert.equal(result.turns[1]!.id, 'new-2');
  });

  it('preserves other session state fields', () => {
    const state = makeSessionState();
    const fetched: IFetchTurnsResult = { turns: [], hasMore: false };
    const result = applyFetchedTurns(state, fetched);
    assert.equal(result.summary.title, 'Test session');
    assert.equal(result.lifecycle, SessionLifecycle.Ready);
  });

  it('does not mutate original state', () => {
    const state = makeSessionState([{
      id: 'keep',
      state: TurnState.Complete,
      userMessage: { text: 'keep' },
      responseParts: [],
      usage: undefined,
    }]);
    const fetched: IFetchTurnsResult = { turns: [], hasMore: false };
    applyFetchedTurns(state, fetched);
    assert.equal(state.turns.length, 1);
  });
});

describe('appendOptimisticUserTurn', () => {
  it('appends a turn with the given text', () => {
    const state = makeSessionState();
    const result = appendOptimisticUserTurn(state, 'hello');
    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0]!.userMessage.text, 'hello');
  });

  it('marks the turn as complete with empty response', () => {
    const state = makeSessionState();
    const result = appendOptimisticUserTurn(state, 'test');
    assert.equal(result.turns[0]!.state, TurnState.Complete);
    assert.equal(result.turns[0]!.responseParts.length, 0);
  });

  it('updates modifiedAt on summary', () => {
    const state = makeSessionState();
    const result = appendOptimisticUserTurn(state, 'test');
    assert.ok(result.summary.modifiedAt >= state.summary.modifiedAt);
  });

  it('preserves existing turns', () => {
    const existing: ITurn = {
      id: 'existing-1',
      state: TurnState.Complete,
      userMessage: { text: 'first' },
      responseParts: [],
      usage: undefined,
    };
    const state = makeSessionState([existing]);
    const result = appendOptimisticUserTurn(state, 'second');
    assert.equal(result.turns.length, 2);
    assert.equal(result.turns[0]!.id, 'existing-1');
  });

  it('does not mutate original state', () => {
    const state = makeSessionState();
    appendOptimisticUserTurn(state, 'test');
    assert.equal(state.turns.length, 0);
  });

  it('generates a local- prefixed id', () => {
    const state = makeSessionState();
    const result = appendOptimisticUserTurn(state, 'test');
    assert.ok(result.turns[0]!.id.startsWith('local-'));
  });
});
