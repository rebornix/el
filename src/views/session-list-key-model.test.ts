import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleSessionListKey } from './session-list-key-model.js';

describe('handleSessionListKey', () => {
  it('moves selection with up/down and clamps', () => {
    assert.deepEqual(handleSessionListKey({ key: { upArrow: true }, selectedIndex: 0, totalItems: 5 }), { type: 'move', selectedIndex: 0 });
    assert.deepEqual(handleSessionListKey({ key: { downArrow: true }, selectedIndex: 0, totalItems: 5 }), { type: 'move', selectedIndex: 1 });
    assert.deepEqual(handleSessionListKey({ key: { downArrow: true }, selectedIndex: 4, totalItems: 5 }), { type: 'move', selectedIndex: 4 });
  });

  it('maps Enter on index 0 to create', () => {
    assert.deepEqual(handleSessionListKey({ key: { return: true }, selectedIndex: 0, totalItems: 5 }), { type: 'create' });
  });

  it('maps Enter on session index to select', () => {
    assert.deepEqual(handleSessionListKey({ key: { return: true }, selectedIndex: 2, totalItems: 5 }), { type: 'select', selectedIndex: 2 });
  });
});
