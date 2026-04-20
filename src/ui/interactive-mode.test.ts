import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapKeypressToPiEvent } from './interactive-mode.js';

describe('mapKeypressToPiEvent', () => {
  it('maps arrow keys and control flags', () => {
    const ev = mapKeypressToPiEvent('', { name: 'up', ctrl: true });
    assert.equal(ev.key.upArrow, true);
    assert.equal(ev.key.ctrl, true);
  });

  it('maps return and tab keys', () => {
    const ret = mapKeypressToPiEvent('\r', { name: 'return' });
    assert.equal(ret.key.return, true);

    const tab = mapKeypressToPiEvent('\t', { name: 'tab' });
    assert.equal(tab.key.tab, true);
  });
});
