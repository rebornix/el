import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

/**
 * Transport interface — the seam for swapping WebSocket with
 * stdio, MessagePort, or any other transport in the future.
 */
export interface ITransport {
  connect(url: string): Promise<void>;
  disconnect(): void;
  send(message: string): void;
  readonly isConnected: boolean;

  on(event: 'message', handler: (data: string) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

export class WebSocketTransport extends EventEmitter implements ITransport {
  private ws: WebSocket | null = null;

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.disconnect();
      }

      let settled = false;
      const ws = new WebSocket(url);

      ws.on('open', () => {
        settled = true;
        this.ws = ws;
        resolve();
      });

      ws.on('message', (data: WebSocket.RawData) => {
        this.emit('message', data.toString());
      });

      ws.on('close', () => {
        this.ws = null;
        this.emit('close');
      });

      ws.on('error', (err: Error) => {
        if (!settled) {
          settled = true;
          reject(err);
        } else {
          this.emit('error', err);
        }
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Transport is not connected');
    }
    this.ws.send(message);
  }
}
