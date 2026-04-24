import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeviceCodeAuthView } from './tunnel-token-flow.js';

describe('buildDeviceCodeAuthView', () => {
  it('constructs auth view with verification URI and user code', () => {
    const view = buildDeviceCodeAuthView({
      device_code: 'abc123',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    });

    assert.equal(view.title, 'Authorize tunnel access');
    assert.equal(view.lines.length, 2);
    assert.ok(view.lines[0]!.includes('https://github.com/login/device'));
    assert.ok(view.lines[1]!.includes('ABCD-1234'));
    assert.equal(view.statusMessage, 'Waiting for authorization...');
  });
});
