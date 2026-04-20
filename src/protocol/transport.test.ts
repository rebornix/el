import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { WebSocketServer } from 'ws';
import { WebSocketTransport } from './transport.js';

function findPort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

describe('WebSocketTransport', () => {
  let server: WebSocketServer;
  let transport: WebSocketTransport;
  let port: number;

  beforeEach(async () => {
    port = await findPort();
    server = new WebSocketServer({ port });
    transport = new WebSocketTransport();
  });

  afterEach(() => {
    transport.disconnect();
    server.close();
  });

  it('connects to a WebSocket server', async () => {
    assert.equal(transport.isConnected, false);
    await transport.connect(`ws://localhost:${port}`);
    assert.equal(transport.isConnected, true);
  });

  it('sends and receives messages', async () => {
    // Echo server
    server.on('connection', (ws) => {
      ws.on('message', (data) => ws.send(data.toString()));
    });

    await transport.connect(`ws://localhost:${port}`);

    const received = new Promise<string>((resolve) => {
      transport.on('message', resolve);
    });

    transport.send('hello');
    assert.equal(await received, 'hello');
  });

  it('emits close on disconnect', async () => {
    await transport.connect(`ws://localhost:${port}`);

    const closed = new Promise<void>((resolve) => {
      transport.on('close', resolve);
    });

    transport.disconnect();
    await closed;
    assert.equal(transport.isConnected, false);
  });

  it('throws when sending on disconnected transport', () => {
    assert.throws(() => transport.send('test'), /not connected/);
  });

  it('rejects connect on invalid url', async () => {
    await assert.rejects(
      () => transport.connect('ws://localhost:1'),
    );
  });

  it('emits close when server closes connection', async () => {
    await transport.connect(`ws://localhost:${port}`);

    const closed = new Promise<void>((resolve) => {
      transport.on('close', resolve);
    });

    // Close all server connections
    server.clients.forEach((client) => client.close());
    await closed;
    assert.equal(transport.isConnected, false);
  });
});
