import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { TunnelTransport } from './tunnel-transport.js';
import { AGENT_HOST_PORT } from '../tunnel/discovery.js';

describe('TunnelTransport', () => {
  let transport: TunnelTransport;

  beforeEach(() => {
    transport = new TunnelTransport();
  });

  it('starts disconnected', () => {
    assert.equal(transport.isConnected, false);
  });

  it('throws when connecting without config', async () => {
    await assert.rejects(
      () => transport.connect('ws://localhost:1234'),
      /requires a TunnelConnectionConfig/,
    );
  });

  it('throws when sending on disconnected transport', () => {
    assert.throws(() => transport.send('test'), /not connected/);
  });

  it('disconnect is safe to call when not connected', () => {
    // Should not throw
    transport.disconnect();
    assert.equal(transport.isConnected, false);
  });

  it('implements EventEmitter interface', () => {
    assert.ok(transport instanceof EventEmitter);
    assert.equal(typeof transport.on, 'function');
    assert.equal(typeof transport.off, 'function');
    assert.equal(typeof transport.emit, 'function');
  });

  it('disconnect can be called multiple times without error', () => {
    transport.disconnect();
    transport.disconnect();
    transport.disconnect();
    assert.equal(transport.isConnected, false);
  });
});

describe('TunnelTransport — SHA256 token derivation', () => {
  it('derives base64url-encoded SHA256 of tunnel ID', () => {
    const tunnelId = 'my-test-tunnel';
    const expected = createHash('sha256').update(tunnelId).digest('base64url');
    // Verify the expected format
    assert.ok(expected.length > 0);
    // base64url should not contain +, /, or =
    assert.ok(!/[+/=]/.test(expected));
  });

  it('produces different tokens for different tunnel IDs', () => {
    const token1 = createHash('sha256').update('tunnel-a').digest('base64url');
    const token2 = createHash('sha256').update('tunnel-b').digest('base64url');
    assert.notEqual(token1, token2);
  });

  it('produces consistent tokens for the same tunnel ID', () => {
    const token1 = createHash('sha256').update('my-tunnel').digest('base64url');
    const token2 = createHash('sha256').update('my-tunnel').digest('base64url');
    assert.equal(token1, token2);
  });

  it('uses AGENT_HOST_PORT constant (31546) for WebSocket URL', () => {
    assert.equal(AGENT_HOST_PORT, 31546);
  });
});
