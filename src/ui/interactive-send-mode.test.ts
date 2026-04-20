import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDispatchInteractiveTurns } from './interactive-send-mode.js';

describe('shouldDispatchInteractiveTurns', () => {
  it('returns false by default', () => {
    assert.equal(shouldDispatchInteractiveTurns({}), false);
  });

  it('accepts truthy values', () => {
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: '1' }), true);
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: 'true' }), true);
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: 'yes' }), true);
  });
});
