import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCreateSessionAgents, nextCreateSessionIndex } from './create-session-model.js';

describe('create session model', () => {
  it('returns empty list when rootState is null', () => {
    assert.equal(getCreateSessionAgents(null).length, 0);
  });

  it('returns agents from rootState', () => {
    const agents = getCreateSessionAgents({ agents: [{ provider: 'a', displayName: 'A' }] } as any);
    assert.equal(agents.length, 1);
    assert.equal(agents[0]!.provider, 'a');
  });

  it('clamps index movement', () => {
    assert.equal(nextCreateSessionIndex(0, 'up', 2), 0);
    assert.equal(nextCreateSessionIndex(0, 'down', 2), 1);
    assert.equal(nextCreateSessionIndex(1, 'down', 2), 1);
  });
});
