import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { Duplex } from 'node:stream';
import WebSocket from 'ws';
import { TunnelRelayTunnelClient } from '@microsoft/dev-tunnels-connections';
import type { Tunnel } from '@microsoft/dev-tunnels-contracts';
import type { TunnelManagementClient } from '@microsoft/dev-tunnels-management';
import type { ITransport } from './transport.js';
import { AGENT_HOST_PORT } from '../tunnel/discovery.js';

/**
 * Configuration for a tunnel connection.
 */
export interface TunnelConnectionConfig {
  /** Resolved tunnel object from the management API. */
  tunnel: Tunnel;
  /** Management client (needed by TunnelRelayTunnelClient). */
  managementClient: TunnelManagementClient;
}

/**
 * Transport implementation that connects to an AHP server
 * running behind a Microsoft Dev Tunnel.
 *
 * Connection flow:
 * 1. TunnelRelayTunnelClient connects to the tunnel relay
 * 2. Wait for port 31546 (AGENT_HOST_PORT) to be forwarded
 * 3. connectToForwardedPort → Duplex stream
 * 4. Wrap the stream in a WebSocket using the `ws` package
 * 5. Standard AHP JSON-RPC protocol over the WebSocket
 */
export class TunnelTransport extends EventEmitter implements ITransport {
  private ws: WebSocket | null = null;
  private relayClient: TunnelRelayTunnelClient | null = null;

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to a tunnel.
   *
   * The `url` parameter is ignored — connection details come from the
   * `config` passed to the constructor.
   * @param _url - Unused, present to satisfy ITransport interface.
   * @param config - Tunnel connection config with resolved tunnel and management client.
   */
  async connect(_url: string, config?: TunnelConnectionConfig): Promise<void> {
    if (!config) {
      throw new Error('TunnelTransport requires a TunnelConnectionConfig');
    }

    if (this.ws) {
      this.disconnect();
    }

    const { tunnel, managementClient } = config;

    // 1. Create relay client and connect
    const relayClient = new TunnelRelayTunnelClient(managementClient);
    this.relayClient = relayClient;

    // Suppress noisy SDK console.log ("Forwarding from …") during connect.
    // The dev-tunnels-connections SDK hard-codes console.log in its TCP listener.
    const origLog = console.log;
    console.log = () => {};
    try {
      await relayClient.connect(tunnel);
    } finally {
      console.log = origLog;
    }

    // 2. Wait for the agent host port to become available
    await relayClient.waitForForwardedPort(AGENT_HOST_PORT);

    // 3. Get a Duplex stream to the forwarded port
    const stream = await relayClient.connectToForwardedPort(AGENT_HOST_PORT);

    // 4. Derive connection token from tunnel ID via SHA256.
    //    This matches VS Code's convention (75f21d0a8d9) so that the AHP server
    //    accepts the handshake. The token is sent as a query parameter on the
    //    WebSocket URL and the server validates it against its own SHA256(tunnelId).
    const tunnelId = tunnel.tunnelId ?? tunnel.name ?? '';
    const token = createHash('sha256').update(tunnelId).digest('base64url');
    const wsUrl = `ws://localhost:${AGENT_HOST_PORT}?tkn=${token}`;

    // 5. Create WebSocket over the Duplex stream
    await this.createWebSocketOverStream(wsUrl, stream);
  }

  /**
   * Wrap a Duplex stream in a WebSocket connection.
   */
  private createWebSocketOverStream(url: string, stream: Duplex): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const ws = new WebSocket(url, {
        createConnection: () => stream as never,
      });

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
    if (this.relayClient) {
      this.relayClient.dispose().catch(() => {});
      this.relayClient = null;
    }
  }

  send(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Transport is not connected');
    }
    this.ws.send(message);
  }
}
