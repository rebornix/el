import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleTunnelListKey } from './tunnel-list-key-model.js';

const noKey = { escape: false, upArrow: false, downArrow: false, return: false, ctrl: false };

describe('handleTunnelListKey', () => {
  it('returns back on escape', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, escape: true },
      input: '',
      tunnelIndex: 0,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'back');
  });

  it('returns noop when loading (ignores all keys except escape)', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, upArrow: true },
      input: '',
      tunnelIndex: 1,
      tunnelCount: 3,
      loading: true,
    });
    assert.equal(action.type, 'noop');
  });

  it('allows escape even while loading', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, escape: true },
      input: '',
      tunnelIndex: 0,
      tunnelCount: 3,
      loading: true,
    });
    assert.equal(action.type, 'back');
  });

  it('moves up', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, upArrow: true },
      input: '',
      tunnelIndex: 2,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; tunnelIndex: number }).tunnelIndex, 1);
  });

  it('clamps up at zero', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, upArrow: true },
      input: '',
      tunnelIndex: 0,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; tunnelIndex: number }).tunnelIndex, 0);
  });

  it('moves up with ctrl+p', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, ctrl: true },
      input: 'p',
      tunnelIndex: 2,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; tunnelIndex: number }).tunnelIndex, 1);
  });

  it('moves down', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, downArrow: true },
      input: '',
      tunnelIndex: 0,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; tunnelIndex: number }).tunnelIndex, 1);
  });

  it('clamps down at last item', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, downArrow: true },
      input: '',
      tunnelIndex: 2,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; tunnelIndex: number }).tunnelIndex, 2);
  });

  it('moves down with ctrl+n', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, ctrl: true },
      input: 'n',
      tunnelIndex: 0,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; tunnelIndex: number }).tunnelIndex, 1);
  });

  it('selects on return when tunnels exist', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, return: true },
      input: '',
      tunnelIndex: 1,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'select');
    assert.equal((action as { type: 'select'; tunnelIndex: number }).tunnelIndex, 1);
  });

  it('returns noop on return when no tunnels', () => {
    const action = handleTunnelListKey({
      key: { ...noKey, return: true },
      input: '',
      tunnelIndex: 0,
      tunnelCount: 0,
      loading: false,
    });
    assert.equal(action.type, 'noop');
  });

  it('returns noop for unrecognized key', () => {
    const action = handleTunnelListKey({
      key: noKey,
      input: 'x',
      tunnelIndex: 0,
      tunnelCount: 3,
      loading: false,
    });
    assert.equal(action.type, 'noop');
  });
});
