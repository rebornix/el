import {
  TunnelManagementHttpClient,
  ManagementApiVersions,
} from '@microsoft/dev-tunnels-management';
import { TunnelAccessScopes } from '@microsoft/dev-tunnels-contracts';
import type { Tunnel } from '@microsoft/dev-tunnels-contracts';
import type { TunnelAuthToken } from '../auth/tunnel-auth.js';
import { authorizationHeader } from '../auth/tunnel-auth.js';

/** Agent Host Protocol port, matching VS Code's convention. */
export const AGENT_HOST_PORT = 31546;

/** Label used by `code tunnel` to identify agent host tunnels. */
export const VSCODE_SERVER_LABEL = 'vscode-server-launcher';

/** Summary info returned by tunnel discovery. */
export interface TunnelInfo {
  tunnelId: string;
  clusterId: string;
  name: string;
  description?: string;
  labels: string[];
  online: boolean;
  hostConnectionCount: number;
  /** The raw Tunnel object from the SDK, useful for connecting. */
  tunnel: Tunnel;
}

/**
 * Create a TunnelManagementHttpClient configured with the given auth token.
 */
export function createManagementClient(
  authToken: TunnelAuthToken,
): TunnelManagementHttpClient {
  const tokenCallback = async () => authorizationHeader(authToken);

  return new TunnelManagementHttpClient(
    'el/0.0.1',
    ManagementApiVersions.Version20230927preview,
    tokenCallback,
  );
}

/**
 * List tunnels that have the `vscode-server-launcher` label
 * and are suitable for agent host connections.
 */
export async function listAvailableTunnels(
  authToken: TunnelAuthToken,
): Promise<TunnelInfo[]> {
  const client = createManagementClient(authToken);
  try {
    const tunnels = await client.listTunnels(undefined, undefined, {
      labels: [VSCODE_SERVER_LABEL],
      includePorts: true,
      tokenScopes: [TunnelAccessScopes.Connect],
    });

    return tunnels.map(tunnelToInfo);
  } finally {
    await client.dispose();
  }
}

/**
 * Resolve a single tunnel by name or ID.
 */
export async function resolveTunnel(
  authToken: TunnelAuthToken,
  nameOrId: string,
): Promise<TunnelInfo | null> {
  const client = createManagementClient(authToken);
  try {
    // The SDK accepts { tunnelId } or { name } for lookup
    const tunnel = await client.getTunnel(
      { name: nameOrId } as Tunnel,
      {
        includePorts: true,
        tokenScopes: [TunnelAccessScopes.Connect],
      },
    );

    if (tunnel) return tunnelToInfo(tunnel);

    // Try by ID if name lookup failed
    const byId = await client.getTunnel(
      { tunnelId: nameOrId } as Tunnel,
      {
        includePorts: true,
        tokenScopes: [TunnelAccessScopes.Connect],
      },
    );

    return byId ? tunnelToInfo(byId) : null;
  } finally {
    await client.dispose();
  }
}

/**
 * Extract the host connection count from a tunnel status.
 * The SDK returns either a plain number or a ResourceStatus object
 * with a `current` field, depending on the API version / response shape.
 */
export function extractHostConnectionCount(status: Tunnel['status']): number {
  const raw = status?.hostConnectionCount;
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw === 'object' && 'current' in raw) {
    return (raw as { current?: number }).current ?? 0;
  }
  return 0;
}

export function tunnelToInfo(t: Tunnel): TunnelInfo {
  const hostCount = extractHostConnectionCount(t.status);

  return {
    tunnelId: t.tunnelId ?? '',
    clusterId: t.clusterId ?? '',
    name: t.name ?? t.tunnelId ?? 'unnamed',
    description: t.description,
    labels: t.labels ?? [],
    online: hostCount > 0,
    hostConnectionCount: hostCount,
    tunnel: t,
  };
}
