import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFetchedTurns } from './pi-tui-live-bootstrap.js';
import { createInteractiveScaffoldState } from './pi-tui-interactive-state.js';
import { ResponsePartKind, TurnState, type ITurn } from '../protocol/types/index.js';

describe('applyFetchedTurns', () => {
  it('replaces turns in session state', () => {
    const state = createInteractiveScaffoldState();

    const turn: ITurn = {
      id: 'new',
      userMessage: { text: 'hi' },
      responseParts: [{ kind: ResponsePartKind.Markdown, id: 'p1', content: 'ok' }],
      usage: undefined,
      state: TurnState.Complete,
    };

    const next = applyFetchedTurns(state, [turn]);
    assert.equal(next.turns.length, 1);
    assert.equal(next.turns[0]?.id, 'new');
  });
});
