import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TextBuffer } from '../text-buffer.js';
import { handleSessionKey } from './session-key-handler.js';

describe('handleSessionKey', () => {
  it('returns send action and clears buffer on Enter with text', () => {
    const buf = new TextBuffer();
    buf.insert('hello');

    const action = handleSessionKey({
      input: '\r',
      key: { return: true },
      buf,
      pendingToolCall: false,
      scrollLineOffset: 0,
      maxScroll: 10,
      availableLines: 20,
    });

    assert.equal(action.type, 'send');
    if (action.type === 'send') assert.equal(action.text, 'hello');
    assert.equal(buf.text, '');
  });

  it('returns tool confirm action when pending tool call is active', () => {
    const buf = new TextBuffer();
    const action = handleSessionKey({
      input: 'y',
      key: {},
      buf,
      pendingToolCall: true,
      scrollLineOffset: 0,
      maxScroll: 10,
      availableLines: 20,
    });

    assert.deepEqual(action, { type: 'tool-confirm', approved: true });
  });

  it('updates scroll offset for up/down keys', () => {
    const buf = new TextBuffer();
    const up = handleSessionKey({
      input: '',
      key: { upArrow: true },
      buf,
      pendingToolCall: false,
      scrollLineOffset: 0,
      maxScroll: 10,
      availableLines: 20,
    });
    assert.deepEqual(up, { type: 'scroll', offset: 3 });

    const down = handleSessionKey({
      input: '',
      key: { downArrow: true },
      buf,
      pendingToolCall: false,
      scrollLineOffset: 3,
      maxScroll: 10,
      availableLines: 20,
    });
    assert.deepEqual(down, { type: 'scroll', offset: 0 });
  });
});
