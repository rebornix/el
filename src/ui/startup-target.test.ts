import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStartupServer } from './startup-target.js';

describe('resolveStartupServer', () => {
  it('uses --server when provided', async () => {
    let prompted = false;
    const target = await resolveStartupServer('ws://localhost:8081', undefined, async () => {
      prompted = true;
      return 'ws://ignored';
    });

    assert.equal(target, 'ws://localhost:8081');
    assert.equal(prompted, false);
  });

  it('prompts when --server is missing', async () => {
    const target = await resolveStartupServer(undefined, undefined, async () => 'tunnel://abc');
    assert.equal(target, 'tunnel://abc');
  });

  it('passes tunnel options through to prompt', async () => {
    let received: unknown;
    await resolveStartupServer(
      undefined,
      { tunnelToken: 'tok', tunnelAuth: 'github' },
      async (opts) => {
        received = opts;
        return 'tunnel://picked';
      },
    );

    assert.deepEqual(received, { tunnelToken: 'tok', tunnelAuth: 'github' });
  });
});
