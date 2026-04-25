import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStartupTargetFrame,
  buildStartupTargetSpinnerUpdate,
  renderStartupTargetScreen,
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
    }), 10);

    assert.equal(frame.authStatusRow, undefined);
    assert.match(frame.output, /^Connect via Dev Tunnel/);
    assert.match(frame.output, /Authorize tunnel access/);
    assert.match(frame.output, /2\) Enter code: ABCD-EFGH/);
    assert.match(frame.output, /⠹ Waiting for authorization\.\.\./);
    // Spinner should be in body, not footer
    const lines = frame.output.split('\n');
    const spinnerLine = lines.findIndex(l => l.includes('⠹ Waiting for authorization...'));
    const escLine = lines.findIndex(l => l.includes('Esc back'));
    assert.ok(spinnerLine < escLine, 'spinner should appear in body before footer');
  });

  it('falls back to full re-render when loading with auth prompt', () => {
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

    assert.equal(update, null);
  });

  it('falls back to full re-render when no auth prompt is active', () => {
    const update = buildStartupTargetSpinnerUpdate(mkState({
      mode: 'tunnel-list',
      loadingTunnels: true,
      spinnerIndex: 1,
    }), undefined);

    assert.equal(update, null);
  });

  it('renders loading tunnels spinner in-place', () => {
    const frame = renderStartupTargetScreen(mkState({
      mode: 'tunnel-list',
      loadingTunnels: true,
      spinnerIndex: 0,
    }), 7);

    const lines = frame.split('\n');
    assert.equal(lines.length, 7);
    assert.match(lines[0]!, /Connect via Dev Tunnel/);
    assert.match(lines[2]!, /⠋ Loading tunnels…/);
    assert.equal(lines[6], 'Esc back');
  });

  it('anchors the menu hint at the bottom', () => {
    const frame = renderStartupTargetScreen(mkState(), 7);
    const lines = frame.split('\n');
    assert.equal(lines.length, 7);
    assert.equal(lines[6], '↑/↓ select · Enter confirm');
  });

  it('anchors the tunnel list hint at the bottom', () => {
    const frame = renderStartupTargetScreen(mkState({
      mode: 'tunnel-list',
      tunnels: [{
        tunnelId: 'abc',
        name: 'abc',
        clusterId: 'cluster',
        labels: [],
        online: true,
        hostConnectionCount: 1,
        tunnel: {} as never,
      }],
    }), 7);

    const lines = frame.split('\n');
    assert.equal(lines.length, 7);
    assert.equal(lines[6], '↑/↓ select · Enter confirm · Esc back');
  });
});
