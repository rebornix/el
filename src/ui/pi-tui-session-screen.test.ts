import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPiTuiSessionScreen, renderPiTuiSessionFrame } from './pi-tui-session-screen.js';

function mkSessionState(overrides: Record<string, any> = {}) {
  return {
    summary: { resource: 'session:test', title: 'Test', status: 'idle', model: 'gpt-4' },
    lifecycle: 'ready',
    turns: [
      {
        id: 't1',
        state: 'completed',
        userMessage: { text: 'hello' },
        responseParts: [{ kind: 'markdown', content: 'world' }],
      },
    ],
    ...overrides,
  } as any;
}

describe('buildPiTuiSessionScreen', () => {
  it('builds plain lines and input line for normal state', () => {
    const screen = buildPiTuiSessionScreen({
      sessionState: mkSessionState(),
      termCols: 80,
      termRows: 24,
      scrollLineOffset: 0,
      inputBeforeCursor: 'abc',
      inputAfterCursor: '',
    });

    assert.ok(screen.lines.length > 0);
    assert.equal(screen.contentRows, 23);
    assert.equal(screen.inputLine, '> abc▊');
    assert.equal(screen.toolPrompt, undefined);
  });

  it('returns tool prompt when pending tool confirmation exists', () => {
    const screen = buildPiTuiSessionScreen({
      sessionState: mkSessionState({
        activeTurn: {
          id: 't2',
          userMessage: { text: 'do thing' },
          responseParts: [
            {
              kind: 'toolCall',
              toolCall: {
                toolCallId: 'tc1',
                toolName: 'WriteFile',
                displayName: 'Write File',
                status: 'pending-confirmation',
                invocationMessage: 'Write to file',
                toolInput: '{}',
              },
            },
          ],
        },
      }),
      termCols: 80,
      termRows: 24,
      scrollLineOffset: 0,
      inputBeforeCursor: '',
      inputAfterCursor: '',
    });

    assert.equal(screen.toolPrompt?.displayName, 'Write File');
    assert.equal(screen.contentRows, 22);
    assert.equal(screen.inputLine, undefined);
  });

  it('pads the session frame to the full terminal height with footer at bottom', () => {
    const frame = renderPiTuiSessionFrame({
      sessionState: mkSessionState(),
      termCols: 80,
      termRows: 8,
      scrollLineOffset: 0,
      inputBeforeCursor: '',
      inputAfterCursor: '',
      footerLine: 'Esc back · Ctrl+C or q to exit',
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 8);
    assert.equal(lines[7], 'Esc back · Ctrl+C or q to exit');
    assert.equal(lines[6], '');
    assert.equal(lines[5], '');
  });
});
