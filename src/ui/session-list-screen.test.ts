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
      rows: 16,
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 16);
    assert.equal(lines[15], '↑/↓ select · Enter open · q quit');
  });

  it('keeps status message above the footer while filling the viewport', () => {
    const frame = renderSessionListFrame({
      sessions: [],
      selectedIndex: 0,
      rows: 16,
      statusMessage: 'No sessions yet. Select "Create new session".',
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 16);
    assert.equal(lines[14], 'No sessions yet. Select "Create new session".');
    assert.equal(lines[15], '↑/↓ select · Enter open · q quit');
  });

  it('renders loading state in-place', () => {
    const frame = renderSessionListFrame({
      sessions: [],
      selectedIndex: 0,
      rows: 16,
      loading: true,
      spinnerIndex: 0,
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 16);
    assert.match(lines[8]!, /⠋ Loading sessions…/);
    assert.equal(lines[15], 'Esc back');
  });
});
