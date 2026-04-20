import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnStartedAction } from './pi-tui-dispatch.js';

describe('buildTurnStartedAction', () => {
  it('builds SessionTurnStarted action shape', () => {
    const action = buildTurnStartedAction('session:test', 'hello');
    assert.equal(action.type, 'session/turnStarted');
    assert.equal(action.session, 'session:test');
    assert.equal(action.userMessage.text, 'hello');
    assert.ok(typeof action.turnId === 'string' && action.turnId.length > 0);
  });
});
