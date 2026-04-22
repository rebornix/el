import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStartupTargetFrame,
  buildStartupTargetSpinnerUpdate,
  type StartupTargetScreenState,
} from './startup-target-screen.js';

function mkState(overrides: Partial<StartupTargetScreenState> = {}): StartupTargetScreenState {
  return {
    mode: 'menu',
    selectedIndex: 0,
    inputBeforeCursor: '',
    inputAfterCursor: '',
    tunnels: [],
    tunnelIndex: 0,
    loadingTunnels: false,
    spinnerIndex: 0,
    ...overrides,
  };
}

describe('startup target screen', () => {
  it('returns auth status row metadata for auth prompts', () => {
    const frame = buildStartupTargetFrame(mkState({
      mode: 'tunnel-list',
      loadingTunnels: true,
      spinnerIndex: 2,
      authView: {
        title: 'Authorize tunnel access',
        lines: [
          '1) Open: https://github.com/login/device',
          '2) Enter code: ABCD-EFGH',
        ],
        statusMessage: 'Waiting for authorization...',
      },
    }));

    assert.equal(frame.authStatusRow, 7);
    assert.match(frame.output, /^\x1b\[2J\x1b\[HConnect via Dev Tunnel/);
    assert.match(frame.output, /Authorize tunnel access/);
    assert.match(frame.output, /2\) Enter code: ABCD-EFGH/);
    assert.match(frame.output, /⠹ Waiting for authorization\.\.\./);
  });

  it('updates only the auth status line during spinner ticks', () => {
    const update = buildStartupTargetSpinnerUpdate(mkState({
      mode: 'tunnel-list',
      loadingTunnels: true,
      spinnerIndex: 3,
      authView: {
        title: 'Sign in to Contoso',
        lines: ['Open the browser link and approve access.'],
        statusMessage: 'Waiting for authorization...',
      },
    }), 5);

    assert.equal(update, '\x1b[5;1H\x1b[2K⠸ Waiting for authorization...');
    assert.doesNotMatch(update ?? '', /\x1b\[2J\x1b\[H/);
  });

  it('falls back to full re-render when no auth prompt is active', () => {
    const update = buildStartupTargetSpinnerUpdate(mkState({
      mode: 'tunnel-list',
      loadingTunnels: true,
      spinnerIndex: 1,
    }), undefined);

    assert.equal(update, null);
  });
});
