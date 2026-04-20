import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleFolderPickerKey } from './folder-picker-key-model.js';

describe('handleFolderPickerKey', () => {
  it('moves selection with up/down and clamps', () => {
    assert.deepEqual(handleFolderPickerKey({
      key: { upArrow: true }, selectedIdx: 0, totalEntries: 4, loading: false, currentUri: 'file:///tmp', sortedDirs: [],
    }), { type: 'move', selectedIndex: 0 });

    assert.deepEqual(handleFolderPickerKey({
      key: { downArrow: true }, selectedIdx: 0, totalEntries: 4, loading: false, currentUri: 'file:///tmp', sortedDirs: [],
    }), { type: 'move', selectedIndex: 1 });
  });

  it('maps esc/tab actions', () => {
    assert.deepEqual(handleFolderPickerKey({
      key: { escape: true }, selectedIdx: 0, totalEntries: 1, loading: false, currentUri: 'file:///tmp', sortedDirs: [],
    }), { type: 'back' });

    assert.deepEqual(handleFolderPickerKey({
      key: { tab: true }, selectedIdx: 0, totalEntries: 1, loading: false, currentUri: 'file:///tmp', sortedDirs: [],
    }), { type: 'select-current' });
  });

  it('enter navigates parent/child when not loading', () => {
    assert.deepEqual(handleFolderPickerKey({
      key: { return: true }, selectedIdx: 0, totalEntries: 3, loading: false, currentUri: 'file:///tmp/a', sortedDirs: [{ name: 'child' }],
    }), { type: 'navigate', uri: 'file:///tmp' });

    assert.deepEqual(handleFolderPickerKey({
      key: { return: true }, selectedIdx: 1, totalEntries: 3, loading: false, currentUri: 'file:///tmp/a', sortedDirs: [{ name: 'child' }],
    }), { type: 'navigate', uri: 'file:///tmp/a/child' });
  });

  it('enter is noop while loading', () => {
    assert.deepEqual(handleFolderPickerKey({
      key: { return: true }, selectedIdx: 0, totalEntries: 2, loading: true, currentUri: 'file:///tmp/a', sortedDirs: [{ name: 'child' }],
    }), { type: 'noop' });
  });
});
