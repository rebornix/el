import { AhpClient } from './client.js';
import { WebSocketTransport } from './transport.js';
import { TunnelTransport } from './tunnel-transport.js';
import { getToken, type TunnelAuthProvider } from '../auth/tunnel-auth.js';
import { createManagementClient, listAvailableTunnels, resolveTunnel, type TunnelInfo } from '../tunnel/discovery.js';

export interface ConnectionOptions {
  serverUrl?: string;
  tunnelToken?: string;
  tunnelAuth?: TunnelAuthProvider;
}

function parseTunnelName(serverUrl: string): string | undefined {
  if (!serverUrl.startsWith('tunnel://')) return undefined;
  const suffix = serverUrl.slice('tunnel://'.length).trim();
  return suffix || undefined;
}

async function chooseTunnel(authToken: { token: string; provider: TunnelAuthProvider }, nameOrId?: string): Promise<TunnelInfo> {
  const tunnels = await listAvailableTunnels(authToken);

  if (nameOrId) {
    const fromList = tunnels.find((t) => t.tunnelId === nameOrId || t.name === nameOrId);
    if (fromList?.tunnel.tunnelId && fromList.tunnel.clusterId) {
      return fromList;
    }

    const resolved = await resolveTunnel(authToken, nameOrId);
    if (resolved?.tunnel.tunnelId && resolved.tunnel.clusterId) {
      return resolved;
    }

    throw new Error(`Tunnel not found or incomplete metadata: ${nameOrId}`);
  }

  if (tunnels.length === 0) {
    throw new Error('No tunnels found for this account. Pass --tunnel <name> or create a tunnel first.');
  }

  const picked = tunnels.find((t) => t.online) ?? tunnels[0]!;
  if (!picked.tunnel.tunnelId || !picked.tunnel.clusterId) {
    throw new Error('Selected tunnel missing required tunnelId/clusterId metadata');
  }
  return picked;
}

export async function connectAhpClient(options: ConnectionOptions): Promise<{ client: AhpClient; disconnect: () => void }> {
  const serverUrl = options.serverUrl ?? 'ws://localhost:8081';

  if (!serverUrl.startsWith('tunnel://')) {
    const transport = new WebSocketTransport();
    const client = new AhpClient(transport, { timeout: 5000 });
    await transport.connect(serverUrl);
    return { client, disconnect: () => client.disconnect() };
  }

  const provider = options.tunnelAuth ?? 'github';
  const token = await getToken({ provider, manualToken: options.tunnelToken });
  if (!token) {
    throw new Error('No tunnel token available. Provide --tunnel-token or sign in to cache one.');
  }

  const tunnelName = parseTunnelName(serverUrl);
  const tunnelInfo = await chooseTunnel(token, tunnelName);

  const managementClient = createManagementClient(token);
  const transport = new TunnelTransport();
  const client = new AhpClient(transport, { timeout: 5000 });

  try {
    await transport.connect('tunnel://', {
      tunnel: tunnelInfo.tunnel,
      managementClient,
    });
  } catch (err) {
    await managementClient.dispose();
    throw err;
  }

  const disconnect = () => {
    client.disconnect();
    void managementClient.dispose();
  };

  return { client, disconnect };
}
