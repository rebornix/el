import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFolderDisplayEntries, computeFolderWindow } from './folder-picker-model.js';
import type { IDirectoryEntry } from '../protocol/types/index.js';

function mkEntries(): IDirectoryEntry[] {
  return [
    { name: 'b', type: 'directory' },
    { name: 'a', type: 'directory' },
    { name: 'z.txt', type: 'file' },
    { name: 'm.txt', type: 'file' },
  ];
}

describe('folder picker model', () => {
  it('builds sorted display entries with .. first', () => {
    const out = buildFolderDisplayEntries(mkEntries());
    assert.equal(out[0]!.display, '..');
    assert.equal(out[1]!.display, 'a/');
    assert.equal(out[2]!.display, 'b/');
    assert.equal(out[3]!.display, 'm.txt');
  });

  it('computes window above/below indicators', () => {
    const display = Array.from({ length: 40 }, (_, i) => ({ name: String(i), display: String(i), isDir: true }));
    const w = computeFolderWindow({ displayEntries: display, selectedIndex: 20, maxHeight: 10 });
    assert.equal(w.hasAbove, true);
    assert.equal(w.hasBelow, true);
  });
});
