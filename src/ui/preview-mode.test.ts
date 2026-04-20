import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRunPiTuiPreview } from './preview-mode.js';

describe('shouldRunPiTuiPreview', () => {
  it('returns false by default', () => {
    assert.equal(shouldRunPiTuiPreview({}), false);
  });

  it('accepts truthy flag values', () => {
    assert.equal(shouldRunPiTuiPreview({ EL_PI_TUI_PREVIEW: '1' }), true);
    assert.equal(shouldRunPiTuiPreview({ EL_PI_TUI_PREVIEW: 'true' }), true);
    assert.equal(shouldRunPiTuiPreview({ EL_PI_TUI_PREVIEW: 'yes' }), true);
  });

  it('returns false for other values', () => {
    assert.equal(shouldRunPiTuiPreview({ EL_PI_TUI_PREVIEW: '0' }), false);
    assert.equal(shouldRunPiTuiPreview({ EL_PI_TUI_PREVIEW: 'no' }), false);
  });
});
