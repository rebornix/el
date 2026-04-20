import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TextBuffer } from '../text-buffer.js';
import { handleServerPromptKey } from './server-prompt-key-model.js';

describe('handleServerPromptKey', () => {
  it('menu navigation + enter actions', () => {
    const buf = new TextBuffer();
    assert.deepEqual(handleServerPromptKey({ mode: 'menu', selectedIndex: 0, input: '', key: { downArrow: true }, buf }), { type: 'select-index', index: 1 });
    assert.deepEqual(handleServerPromptKey({ mode: 'menu', selectedIndex: 0, input: '', key: { return: true }, buf }), { type: 'submit', url: 'tunnel://' });
    assert.deepEqual(handleServerPromptKey({ mode: 'menu', selectedIndex: 1, input: '', key: { return: true }, buf }), { type: 'mode', mode: 'url-input' });
  });

  it('url mode validates and submits', () => {
    const buf = new TextBuffer();
    buf.insert('http://x');
    assert.deepEqual(handleServerPromptKey({ mode: 'url-input', selectedIndex: 0, input: '', key: { return: true }, buf }), { type: 'error', message: 'URL must start with ws:// or wss://' });
    buf.clear();
    buf.insert('ws://localhost:8081');
    assert.deepEqual(handleServerPromptKey({ mode: 'url-input', selectedIndex: 0, input: '', key: { return: true }, buf }), { type: 'submit', url: 'ws://localhost:8081' });
  });
});
