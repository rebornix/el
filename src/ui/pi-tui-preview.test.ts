import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderPiTuiPreview } from './pi-tui-preview.js';

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

describe('renderPiTuiPreview', () => {
  it('renders normal preview including input line', () => {
    const text = renderPiTuiPreview({
      sessionState: mkSessionState(),
      inputBeforeCursor: 'abc',
    });

    assert.ok(text.includes('--- pi-tui preview ---'));
    assert.ok(text.includes('> abc▊'));
  });

  it('renders tool prompt when pending confirmation exists', () => {
    const text = renderPiTuiPreview({
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
    });

    assert.ok(text.includes('[tool] Write File'));
    assert.ok(!text.includes('> ▊'));
  });

  it('can render without debug preview header', () => {
    const text = renderPiTuiPreview({
      sessionState: mkSessionState(),
      inputBeforeCursor: 'abc',
      debugHeader: false,
    });

    assert.ok(!text.includes('--- pi-tui preview ---'));
    assert.ok(text.includes('> abc▊'));
  });
});
