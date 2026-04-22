import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSelectionWindow } from './selection-window.js';

describe('computeSelectionWindow', () => {
  it('centers the selected item when possible', () => {
    const window = computeSelectionWindow({
      totalItems: 50,
      selectedIndex: 20,
      windowSize: 9,
    });

    assert.equal(window.startIdx, 16);
    assert.equal(window.endIdx, 25);
    assert.equal(window.hasAbove, true);
    assert.equal(window.hasBelow, true);
  });

  it('clamps to the start of the list', () => {
    const window = computeSelectionWindow({
      totalItems: 4,
      selectedIndex: 0,
      windowSize: 10,
    });

    assert.equal(window.startIdx, 0);
    assert.equal(window.endIdx, 4);
    assert.equal(window.hasAbove, false);
    assert.equal(window.hasBelow, false);
  });
});
