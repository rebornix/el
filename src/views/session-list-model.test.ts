import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSessionListWindow } from './session-list-model.js';
import type { ISessionSummary } from '../protocol/types/index.js';
import { SessionStatus } from '../protocol/types/index.js';

function mkSessions(n: number): ISessionSummary[] {
  return Array.from({ length: n }, (_, i) => ({
    resource: `session:${i + 1}`,
    title: `Session ${i + 1}`,
    provider: 'test',
    status: SessionStatus.Idle,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  }));
}

describe('computeSessionListWindow', () => {
  it('shows full list when items fit', () => {
    const w = computeSessionListWindow({
      sessions: mkSessions(3),
      rootState: null,
      selectedIndex: 0,
      terminalRows: 30,
    });

    assert.equal(w.startIdx, 0);
    assert.equal(w.hasAbove, false);
    assert.equal(w.hasBelow, false);
  });

  it('shows above indicator when selected is deep in list', () => {
    const w = computeSessionListWindow({
      sessions: mkSessions(50),
      rootState: null,
      selectedIndex: 30,
      terminalRows: 15,
    });

    assert.equal(w.hasAbove, true);
    assert.equal(w.hasBelow, true);
  });
});
