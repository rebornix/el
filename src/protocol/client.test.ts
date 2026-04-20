import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AhpClient, JsonRpcError } from './client.js';
import type { ITransport } from './transport.js';

/**
 * Mock transport for testing the JSON-RPC layer without a real WebSocket.
 */
class MockTransport extends EventEmitter implements ITransport {
  sent: string[] = [];
  private _connected = true;

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    this._connected = true;
  }

  disconnect(): void {
    this._connected = false;
  }

  send(message: string): void {
    if (!this._connected) throw new Error('Transport is not connected');
    this.sent.push(message);
  }

  // Simulate receiving a message from the server
  simulateMessage(data: unknown): void {
    this.emit('message', JSON.stringify(data));
  }

  simulateClose(): void {
    this._connected = false;
    this.emit('close');
  }
}

describe('AhpClient', () => {
  let transport: MockTransport;
  let client: AhpClient;

  beforeEach(() => {
    transport = new MockTransport();
    client = new AhpClient(transport, { timeout: 1000 });
  });

  describe('request/response', () => {
    it('sends a JSON-RPC request and resolves on success', async () => {
      const promise = client.request('listSessions', {});

      // Check the sent message
      assert.equal(transport.sent.length, 1);
      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.jsonrpc, '2.0');
      assert.equal(sent.method, 'listSessions');
      assert.equal(typeof sent.id, 'number');

      // Simulate server response
      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        result: { sessions: [] },
      });

      const result = await promise;
      assert.deepEqual(result, { sessions: [] });
    });

    it('rejects on JSON-RPC error response', async () => {
      const promise = client.request('listSessions', {});
      const sent = JSON.parse(transport.sent[0]!);

      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        error: { code: -32001, message: 'Session not found' },
      });

      await assert.rejects(promise, (err: JsonRpcError) => {
        assert.equal(err.code, -32001);
        assert.equal(err.message, 'Session not found');
        return true;
      });
    });

    it('rejects on timeout', async () => {
      const promise = client.request('listSessions', {}, 50);

      await assert.rejects(promise, /timed out/);
    });

    it('correlates responses by id', async () => {
      const p1 = client.request('listSessions', {});
      const p2 = client.request('listSessions', {});

      const sent1 = JSON.parse(transport.sent[0]!);
      const sent2 = JSON.parse(transport.sent[1]!);

      // Respond in reverse order
      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent2.id,
        result: { sessions: ['b'] },
      });
      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent1.id,
        result: { sessions: ['a'] },
      });

      const r1 = await p1;
      const r2 = await p2;
      assert.deepEqual(r1, { sessions: ['a'] });
      assert.deepEqual(r2, { sessions: ['b'] });
    });

    it('increments request ids', () => {
      client.request('listSessions', {}).catch(() => {}); // ignore timeout
      client.request('listSessions', {}).catch(() => {}); // ignore timeout

      const id1 = JSON.parse(transport.sent[0]!).id;
      const id2 = JSON.parse(transport.sent[1]!).id;
      assert.equal(id2, id1 + 1);

      // Clean up pending requests
      client.disconnect();
    });
  });

  describe('notifications', () => {
    it('sends notifications without id', () => {
      client.notify('dispatchAction', { session: 'test', action: {} });

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.jsonrpc, '2.0');
      assert.equal(sent.method, 'dispatchAction');
      assert.equal(sent.id, undefined);
    });

    it('emits received notifications', async () => {
      const received = new Promise<unknown>((resolve) => {
        client.on('notification', resolve);
      });

      transport.simulateMessage({
        jsonrpc: '2.0',
        method: 'action',
        params: { serverSeq: 1 },
      });

      const notif = await received;
      assert.deepEqual(notif, {
        jsonrpc: '2.0',
        method: 'action',
        params: { serverSeq: 1 },
      });
    });
  });

  describe('typed AHP commands', () => {
    it('initialize sends correct params', async () => {
      const promise = client.initialize('test-client', ['agenthost:/root']);

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'initialize');
      assert.equal(sent.params.clientId, 'test-client');
      assert.equal(sent.params.protocolVersion, 1);
      assert.deepEqual(sent.params.initialSubscriptions, ['agenthost:/root']);

      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        result: { protocolVersion: 1, serverSeq: 0, snapshots: [] },
      });

      const result = await promise;
      assert.equal(result.protocolVersion, 1);
    });

    it('listSessions sends correct method', async () => {
      const promise = client.listSessions();

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'listSessions');

      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        result: { items: [{ resource: 'copilot:/abc', provider: 'copilot', title: 'Test' }] },
      });

      const result = await promise;
      assert.equal(result.items.length, 1);
    });

    it('subscribe sends resource URI', async () => {
      const promise = client.subscribe('copilot:/abc');

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'subscribe');
      assert.equal(sent.params.resource, 'copilot:/abc');

      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        result: { snapshot: {}, fromSeq: 0 },
      });

      await promise;
    });

    it('unsubscribe sends notification (no id)', () => {
      client.unsubscribe('copilot:/abc');

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'unsubscribe');
      assert.equal(sent.params.resource, 'copilot:/abc');
      assert.equal(sent.id, undefined);
    });

    it('dispatchAction sends notification with clientSeq', () => {
      const action = { type: 'session/turnStarted', turnId: 't1' };
      client.dispatchAction(1, action as any);

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'dispatchAction');
      assert.equal(sent.params.clientSeq, 1);
      assert.deepEqual(sent.params.action, action);
      assert.equal(sent.id, undefined);
    });

    it('createSession sends correct params', async () => {
      const promise = client.createSession({
        session: 'copilot:/new-session',
        provider: 'copilot',
      });

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'createSession');
      assert.equal(sent.params.session, 'copilot:/new-session');
      assert.equal(sent.params.provider, 'copilot');

      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        result: null,
      });

      await promise;
    });

    it('resourceList sends correct method and URI', async () => {
      const promise = client.resourceList('file:///workspace');

      const sent = JSON.parse(transport.sent[0]!);
      assert.equal(sent.method, 'resourceList');
      assert.equal(sent.params.uri, 'file:///workspace');

      transport.simulateMessage({
        jsonrpc: '2.0',
        id: sent.id,
        result: { entries: [{ name: 'src', type: 'directory' }, { name: 'readme.md', type: 'file' }] },
      });

      const result = await promise;
      assert.equal(result.entries.length, 2);
      assert.equal(result.entries[0]!.name, 'src');
      assert.equal(result.entries[0]!.type, 'directory');
    });
  });

  describe('connection lifecycle', () => {
    it('rejects all pending requests on close', async () => {
      const p1 = client.request('listSessions', {});
      const p2 = client.request('listSessions', {});

      transport.simulateClose();

      await assert.rejects(p1, /Connection closed/);
      await assert.rejects(p2, /Connection closed/);
    });

    it('emits close event', async () => {
      const closed = new Promise<void>((resolve) => {
        client.on('close', resolve);
      });

      transport.simulateClose();
      await closed;
    });

    it('disconnect rejects pending and closes transport', async () => {
      const p1 = client.request('listSessions', {});

      client.disconnect();

      await assert.rejects(p1, /Client disconnected/);
      assert.equal(transport.isConnected, false);
    });
  });
});
