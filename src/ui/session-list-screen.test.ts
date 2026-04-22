import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ISessionSummary } from '../protocol/types/index.js';
import { SessionStatus } from '../protocol/types/index.js';
import { renderSessionListFrame } from './session-list-screen.js';

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

describe('renderSessionListFrame', () => {
  it('pads the list frame to the full terminal height', () => {
    const frame = renderSessionListFrame({
      sessions: mkSessions(1),
      selectedIndex: 0,
      rows: 8,
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 8);
    assert.equal(lines[7], '↑/↓ select · Enter open · q quit');
    assert.equal(lines[6], '');
  });

  it('keeps status message above the footer while filling the viewport', () => {
    const frame = renderSessionListFrame({
      sessions: [],
      selectedIndex: 0,
      rows: 7,
      statusMessage: 'Loading sessions…',
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 7);
    assert.equal(lines[5], 'Loading sessions…');
    assert.equal(lines[6], '↑/↓ select · Enter open · q quit');
  });
});
