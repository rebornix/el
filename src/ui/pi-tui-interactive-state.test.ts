import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ResponsePartKind } from '../protocol/types/index.js';
import { createInteractiveScaffoldState, appendScaffoldTurn } from './pi-tui-interactive-state.js';

describe('pi-tui interactive state', () => {
  it('creates an empty session state', () => {
    const state = createInteractiveScaffoldState();
    assert.equal(state.turns.length, 0);
    assert.equal(state.summary.title, 'pi-tui session');
  });

  it('appends a completed user+echo turn', () => {
    const state = createInteractiveScaffoldState();
    const next = appendScaffoldTurn(state, 'hello');

    assert.equal(next.turns.length, 1);
    assert.equal(next.turns[0]!.userMessage.text, 'hello');
    const firstPart = next.turns[0]!.responseParts[0];
    assert.ok(firstPart);
    assert.equal(firstPart.kind, ResponsePartKind.Markdown);
    assert.equal(firstPart.content, 'Echo: hello');
  });
});
