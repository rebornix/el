import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDispatchInteractiveTurns } from './interactive-send-mode.js';

describe('shouldDispatchInteractiveTurns', () => {
  it('returns true by default', () => {
    assert.equal(shouldDispatchInteractiveTurns({}), true);
  });

  it('accepts truthy values', () => {
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: '1' }), true);
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: 'true' }), true);
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: 'yes' }), true);
  });

  it('can be disabled explicitly', () => {
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: '0' }), false);
    assert.equal(shouldDispatchInteractiveTurns({ EL_PI_TUI_DISPATCH: 'false' }), false);
  });
});
