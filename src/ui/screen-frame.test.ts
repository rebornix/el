import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeFrameBodyRows, computeWindowRows, renderScreenFrame } from './screen-frame.js';

describe('screen frame', () => {
  it('pads body lines so the footer stays at the bottom', () => {
    const frame = renderScreenFrame({
      rows: 6,
      bodyLines: ['Title', '', 'Body'],
      footerLines: ['Hint'],
    });

    const lines = frame.split('\n');
    assert.equal(lines.length, 6);
    assert.equal(lines[5], 'Hint');
    assert.equal(lines[4], '');
  });

  it('computes frame body rows from terminal rows and footer height', () => {
    assert.equal(computeFrameBodyRows(24, 1), 23);
    assert.equal(computeFrameBodyRows(24, 2), 22);
  });

  it('computes content window rows after header, footer, and reserved lines', () => {
    const rows = computeWindowRows({
      rows: 24,
      headerLineCount: 2,
      footerLineCount: 1,
      reservedLineCount: 2,
      minimumRows: 5,
    });

    assert.equal(rows, 19);
  });
});
