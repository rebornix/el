import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderCreateAgentFrame, renderFolderPickerFrame } from './create-session-screens.js';

describe('create session screens', () => {
  it('anchors the agent picker footer at the bottom', () => {
    const frame = renderCreateAgentFrame({
      providers: ['copilot'],
      selectedIndex: 0,
      rows: 7,
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 7);
    assert.equal(lines[6], '↑/↓ select · Enter next · Esc back');
  });

  it('anchors the folder picker footer at the bottom', () => {
    const frame = renderFolderPickerFrame({
      currentUri: 'file:///Users/me/project',
      entries: [
        { name: '..', display: '..', isDir: true },
        { name: 'src', display: 'src/', isDir: true },
      ],
      selectedIndex: 1,
      rows: 8,
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 8);
    assert.equal(lines[7], 'Tab select current · Enter open dir · Esc back');
  });
});
