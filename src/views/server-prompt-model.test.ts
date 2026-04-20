import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MENU_OPTIONS, nextMenuIndex, validateServerUrl } from './server-prompt-model.js';

describe('server prompt model', () => {
  it('has expected two menu options', () => {
    assert.equal(MENU_OPTIONS.length, 2);
    assert.equal(MENU_OPTIONS[0]!.value, 'tunnel://');
    assert.equal(MENU_OPTIONS[1]!.value, 'local');
  });

  it('clamps menu index navigation', () => {
    assert.equal(nextMenuIndex(0, 'up'), 0);
    assert.equal(nextMenuIndex(0, 'down'), 1);
    assert.equal(nextMenuIndex(1, 'down'), 1);
  });

  it('validates ws/wss url only', () => {
    assert.equal(validateServerUrl('ws://localhost:8081'), undefined);
    assert.equal(validateServerUrl('wss://example.com'), undefined);
    assert.equal(validateServerUrl('http://example.com'), 'URL must start with ws:// or wss://');
    assert.equal(validateServerUrl(''), 'URL is required');
  });
});
