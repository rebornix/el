import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleCreateAgentKey } from './create-agent-key-model.js';

describe('handleCreateAgentKey', () => {
  it('returns back on escape', () => {
    const action = handleCreateAgentKey({
      key: { escape: true, upArrow: false, downArrow: false, return: false },
      providerIndex: 1,
      providerCount: 3,
    });
    assert.equal(action.type, 'back');
  });

  it('moves up', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: true, downArrow: false, return: false },
      providerIndex: 2,
      providerCount: 3,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; providerIndex: number }).providerIndex, 1);
  });

  it('clamps up at zero', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: true, downArrow: false, return: false },
      providerIndex: 0,
      providerCount: 3,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; providerIndex: number }).providerIndex, 0);
  });

  it('moves down', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: false, downArrow: true, return: false },
      providerIndex: 0,
      providerCount: 3,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; providerIndex: number }).providerIndex, 1);
  });

  it('clamps down at last item', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: false, downArrow: true, return: false },
      providerIndex: 2,
      providerCount: 3,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; providerIndex: number }).providerIndex, 2);
  });

  it('confirms on return', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: false, downArrow: false, return: true },
      providerIndex: 1,
      providerCount: 3,
    });
    assert.equal(action.type, 'confirm');
  });

  it('returns noop for unrecognized key', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: false, downArrow: false, return: false },
      providerIndex: 0,
      providerCount: 3,
    });
    assert.equal(action.type, 'noop');
  });

  it('handles zero providers gracefully', () => {
    const action = handleCreateAgentKey({
      key: { escape: false, upArrow: false, downArrow: true, return: false },
      providerIndex: 0,
      providerCount: 0,
    });
    assert.equal(action.type, 'move');
    assert.equal((action as { type: 'move'; providerIndex: number }).providerIndex, 0);
  });
});
