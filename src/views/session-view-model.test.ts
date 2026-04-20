import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionViewportModel } from './session-view-model.js';

function mkSessionState(turnText: string) {
  return {
    summary: { resource: 'session:test', title: 'Test', status: 'idle', model: 'gpt-4' },
    lifecycle: 'ready',
    turns: [
      {
        id: 't1',
        state: 'completed',
        userMessage: { text: turnText },
        responseParts: [{ kind: 'markdown', content: 'ok' }],
      },
    ],
  } as any;
}

describe('buildSessionViewportModel', () => {
  it('returns empty model when session state is null', () => {
    const model = buildSessionViewportModel({
      sessionState: null,
      termCols: 80,
      termRows: 24,
      scrollLineOffset: 0,
    });

    assert.equal(model.totalLines, 0);
    assert.equal(model.maxScroll, 0);
    assert.equal(model.visibleLines.length, 0);
  });

  it('builds viewport lines from rendered turns', () => {
    const model = buildSessionViewportModel({
      sessionState: mkSessionState('hello world'),
      termCols: 80,
      termRows: 24,
      scrollLineOffset: 0,
    });

    assert.ok(model.totalLines > 0);
    assert.ok(model.visibleLines.length > 0);
  });

  it('computes non-zero maxScroll for long content in short viewport', () => {
    const longText = 'x'.repeat(2000);
    const model = buildSessionViewportModel({
      sessionState: mkSessionState(longText),
      termCols: 40,
      termRows: 12,
      scrollLineOffset: 0,
    });

    assert.ok(model.maxScroll > 0);
  });
});
