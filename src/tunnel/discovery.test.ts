import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_HOST_PORT,
  VSCODE_SERVER_LABEL,
  extractHostConnectionCount,
  tunnelToInfo,
} from './discovery.js';
import type { TunnelInfo } from './discovery.js';
import type { Tunnel } from '@microsoft/dev-tunnels-contracts';

describe('tunnel discovery constants', () => {
  it('AGENT_HOST_PORT is 31546', () => {
    assert.equal(AGENT_HOST_PORT, 31546);
  });

  it('VSCODE_SERVER_LABEL matches expected value', () => {
    assert.equal(VSCODE_SERVER_LABEL, 'vscode-server-launcher');
  });
});

describe('extractHostConnectionCount', () => {
  it('returns 0 for undefined status', () => {
    assert.equal(extractHostConnectionCount(undefined), 0);
  });

  it('returns 0 for status without hostConnectionCount', () => {
    assert.equal(extractHostConnectionCount({} as Tunnel['status']), 0);
  });

  it('returns number directly when hostConnectionCount is a number', () => {
    assert.equal(
      extractHostConnectionCount({ hostConnectionCount: 3 } as Tunnel['status']),
      3,
    );
  });

  it('returns 0 when hostConnectionCount is 0', () => {
    assert.equal(
      extractHostConnectionCount({ hostConnectionCount: 0 } as Tunnel['status']),
      0,
    );
  });

  it('extracts current from ResourceStatus object', () => {
    const status = {
      hostConnectionCount: { current: 2 },
    } as unknown as Tunnel['status'];
    assert.equal(extractHostConnectionCount(status), 2);
  });

  it('returns 0 when ResourceStatus has no current field', () => {
    const status = {
      hostConnectionCount: { limit: 10 },
    } as unknown as Tunnel['status'];
    assert.equal(extractHostConnectionCount(status), 0);
  });
});

describe('tunnelToInfo', () => {
  it('converts online tunnel with all fields', () => {
    const tunnel: Tunnel = {
      tunnelId: 'abc123',
      clusterId: 'usw2',
      name: 'my-machine',
      description: 'My dev machine',
      labels: ['vscode-server-launcher'],
      status: { hostConnectionCount: 1 },
    };
    const info = tunnelToInfo(tunnel);
    assert.equal(info.tunnelId, 'abc123');
    assert.equal(info.clusterId, 'usw2');
    assert.equal(info.name, 'my-machine');
    assert.equal(info.description, 'My dev machine');
    assert.deepEqual(info.labels, ['vscode-server-launcher']);
    assert.equal(info.online, true);
    assert.equal(info.hostConnectionCount, 1);
    assert.equal(info.tunnel, tunnel);
  });

  it('converts offline tunnel', () => {
    const tunnel: Tunnel = {
      tunnelId: 'def456',
      clusterId: 'euw1',
      name: 'offline-box',
      status: { hostConnectionCount: 0 },
    };
    const info = tunnelToInfo(tunnel);
    assert.equal(info.online, false);
    assert.equal(info.hostConnectionCount, 0);
  });

  it('handles missing name — falls back to tunnelId', () => {
    const tunnel: Tunnel = { tunnelId: 'xyz789', clusterId: 'usw2' };
    const info = tunnelToInfo(tunnel);
    assert.equal(info.name, 'xyz789');
  });

  it('handles missing tunnelId and name — falls back to unnamed', () => {
    const tunnel: Tunnel = { clusterId: 'usw2' };
    const info = tunnelToInfo(tunnel);
    assert.equal(info.name, 'unnamed');
    assert.equal(info.tunnelId, '');
  });

  it('handles missing labels — defaults to empty array', () => {
    const tunnel: Tunnel = { tunnelId: 'abc', clusterId: 'usw2' };
    const info = tunnelToInfo(tunnel);
    assert.deepEqual(info.labels, []);
  });

  it('handles missing status — defaults to offline', () => {
    const tunnel: Tunnel = { tunnelId: 'abc', clusterId: 'usw2' };
    const info = tunnelToInfo(tunnel);
    assert.equal(info.online, false);
    assert.equal(info.hostConnectionCount, 0);
  });
});
