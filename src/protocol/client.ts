import { EventEmitter } from 'node:events';
import type { ITransport } from './transport.js';
import type {
  ICommandMap,
  IJsonRpcErrorResponse,
  IAhpNotification,
} from './types/index.js';
import type {
  IInitializeResult,
  ISubscribeResult,
  IListSessionsResult,
  IFetchTurnsResult,
  IResourceListResult,
  ICreateSessionParams,
  ISubscribeParams,
  IFetchTurnsParams,
  IDispatchActionParams,
  IUnsubscribeParams,
  URI,
} from './types/index.js';
import { PROTOCOL_VERSION } from './types/index.js';
import type { IStateAction } from './types/index.js';

export class JsonRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'JsonRpcError';
  }
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ─── AhpClient ───────────────────────────────────────────────────────────────

/**
 * JSON-RPC 2.0 client for the Agent Host Protocol.
 *
 * Handles request/response correlation (by id), notification routing,
 * and typed command methods built on top.
 */
export class AhpClient extends EventEmitter {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly transport: ITransport;
  private readonly defaultTimeout: number;

  constructor(transport: ITransport, options?: { timeout?: number }) {
    super();
    this.transport = transport;
    this.defaultTimeout = options?.timeout ?? 30_000;

    this.transport.on('message', (data: string) => this.handleMessage(data));
    this.transport.on('close', () => {
      this.rejectAllPending(new Error('Connection closed'));
      this.emit('close');
    });
    this.transport.on('error', (err: Error) => this.emit('error', err));
  }

  get isConnected(): boolean {
    return this.transport.isConnected;
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  async request<M extends keyof ICommandMap>(
    method: M,
    params: ICommandMap[M]['params'],
    timeout?: number,
  ): Promise<ICommandMap[M]['result']> {
    const id = this.nextId++;
    const message = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    });

    return new Promise<ICommandMap[M]['result']>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} (id=${id}) timed out`));
      }, timeout ?? this.defaultTimeout);

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      try {
        this.transport.send(message);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  notify(method: string, params: unknown): void {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });
    this.transport.send(message);
  }

  /**
   * Disconnect the underlying transport and reject all pending requests.
   */
  disconnect(): void {
    this.rejectAllPending(new Error('Client disconnected'));
    this.transport.disconnect();
  }

  // ── Typed AHP Commands ──

  /**
   * Initialize the connection. Must be the first message sent.
   */
  initialize(clientId: string, initialSubscriptions?: URI[]): Promise<IInitializeResult> {
    return this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientId,
      initialSubscriptions,
    });
  }

  subscribe(resource: URI): Promise<ISubscribeResult> {
    return this.request('subscribe', { resource });
  }

  /**
   * Unsubscribe from a state resource URI. (fire-and-forget notification)
   */
  unsubscribe(resource: URI): void {
    this.notify('unsubscribe', { resource } satisfies IUnsubscribeParams);
  }

  listSessions(): Promise<IListSessionsResult> {
    return this.request('listSessions', {});
  }

  createSession(params: ICreateSessionParams): Promise<null> {
    return this.request('createSession', params);
  }

  /**
   * Dispatch an action (fire-and-forget, write-ahead).
   */
  dispatchAction(clientSeq: number, action: IStateAction): void {
    this.notify('dispatchAction', {
      clientSeq,
      action,
    } satisfies IDispatchActionParams);
  }

  /**
   * Fetch historical turns for a session.
   */
  fetchTurns(params: IFetchTurnsParams): Promise<IFetchTurnsResult> {
    return this.request('fetchTurns', params);
  }

  /**
   * List directory entries at a file URI on the server's filesystem.
   */
  resourceList(uri: URI): Promise<IResourceListResult> {
    return this.request('resourceList', { uri });
  }

  private handleMessage(data: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.emit('error', new Error(`Invalid JSON: ${data.slice(0, 100)}`));
      return;
    }

    const msg = parsed as Record<string, unknown>;

    // Response (has id, has result or error)
    if (typeof msg.id === 'number' && ('result' in msg || 'error' in msg)) {
      this.handleResponse(msg as unknown as { id: number; result?: unknown; error?: { code: number; message: string; data?: unknown } });
      return;
    }

    // Notification (has method, no id)
    if (typeof msg.method === 'string' && !('id' in msg)) {
      this.emit('notification', msg as unknown as IAhpNotification);
      return;
    }

    // Unknown message shape
    this.emit('error', new Error(`Unrecognized message: ${data.slice(0, 200)}`));
  }

  private handleResponse(msg: { id: number; result?: unknown; error?: { code: number; message: string; data?: unknown } }): void {
    const pending = this.pending.get(msg.id);
    if (!pending) {
      return; // Orphaned response, ignore
    }

    clearTimeout(pending.timer);
    this.pending.delete(msg.id);

    if (msg.error) {
      pending.reject(new JsonRpcError(msg.error.code, msg.error.message, msg.error.data));
    } else {
      pending.resolve(msg.result);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
