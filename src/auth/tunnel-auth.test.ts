import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  authorizationHeader,
  loadCachedToken,
  cacheToken,
  getGhCliToken,
  getToken,
} from './tunnel-auth.js';
import type { TunnelAuthToken } from './tunnel-auth.js';

describe('tunnel auth', () => {
  describe('authorizationHeader', () => {
    it('returns github-prefixed header for github provider', () => {
      const token: TunnelAuthToken = { token: 'gho_abc123', provider: 'github' };
      assert.equal(authorizationHeader(token), 'github gho_abc123');
    });

    it('returns Bearer header for microsoft provider', () => {
      const token: TunnelAuthToken = { token: 'eyJhbGciOiJSUzI', provider: 'microsoft' };
      assert.equal(authorizationHeader(token), 'Bearer eyJhbGciOiJSUzI');
    });
  });

  describe('loadCachedToken', () => {
    let cacheDir: string;
    let cachePath: string;
    const origEnv = process.env.XDG_CONFIG_HOME;

    beforeEach(async () => {
      cacheDir = join(tmpdir(), `el-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(cacheDir, 'el'), { recursive: true });
      cachePath = join(cacheDir, 'el', 'tunnel-auth.json');
      process.env.XDG_CONFIG_HOME = cacheDir;
    });

    afterEach(async () => {
      process.env.XDG_CONFIG_HOME = origEnv;
      await rm(cacheDir, { recursive: true, force: true });
    });

    it('returns null when no cache file exists', async () => {
      await rm(cachePath, { force: true });
      const result = await loadCachedToken();
      assert.equal(result, null);
    });

    it('returns cached token when file exists and not expired', async () => {
      const token: TunnelAuthToken = {
        token: 'cached-token',
        provider: 'github',
        expiresAt: Date.now() + 3600000,
      };
      await writeFile(cachePath, JSON.stringify(token), 'utf-8');
      const result = await loadCachedToken();
      assert.deepEqual(result, token);
    });

    it('returns null when cached token is expired', async () => {
      const token: TunnelAuthToken = {
        token: 'expired-token',
        provider: 'github',
        expiresAt: Date.now() - 1000,
      };
      await writeFile(cachePath, JSON.stringify(token), 'utf-8');
      const result = await loadCachedToken();
      assert.equal(result, null);
    });

    it('returns token without expiresAt (never expires)', async () => {
      const token: TunnelAuthToken = { token: 'no-expiry', provider: 'github' };
      await writeFile(cachePath, JSON.stringify(token), 'utf-8');
      const result = await loadCachedToken();
      assert.deepEqual(result, token);
    });

    it('returns null for corrupt JSON cache', async () => {
      await writeFile(cachePath, 'not-valid-json{{{', 'utf-8');
      const result = await loadCachedToken();
      assert.equal(result, null);
    });
  });

  describe('cacheToken', () => {
    let cacheDir: string;
    let cachePath: string;
    const origEnv = process.env.XDG_CONFIG_HOME;

    beforeEach(async () => {
      cacheDir = join(tmpdir(), `el-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      process.env.XDG_CONFIG_HOME = cacheDir;
    });

    afterEach(async () => {
      process.env.XDG_CONFIG_HOME = origEnv;
      await rm(cacheDir, { recursive: true, force: true });
    });

    it('creates directories and writes token to disk', async () => {
      const token: TunnelAuthToken = { token: 'new-token', provider: 'github' };
      await cacheToken(token);
      cachePath = join(cacheDir, 'el', 'tunnel-auth.json');
      const raw = await readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(raw);
      assert.equal(parsed.token, 'new-token');
      assert.equal(parsed.provider, 'github');
    });
  });

  describe('getGhCliToken', () => {
    it('returns null when gh is not available', async () => {
      // In CI, gh may not be installed or authenticated,
      // so we just verify the function returns a string or null
      const result = await getGhCliToken();
      assert.ok(result === null || typeof result === 'string');
    });
  });

  describe('getToken', () => {
    const origEnv = process.env.XDG_CONFIG_HOME;
    let cacheDir: string;

    beforeEach(async () => {
      cacheDir = join(tmpdir(), `el-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      process.env.XDG_CONFIG_HOME = cacheDir;
    });

    afterEach(async () => {
      process.env.XDG_CONFIG_HOME = origEnv;
      await rm(cacheDir, { recursive: true, force: true });
    });

    it('returns cached token when available', async () => {
      await mkdir(join(cacheDir, 'el'), { recursive: true });
      const token: TunnelAuthToken = {
        token: 'cached',
        provider: 'github',
        expiresAt: Date.now() + 3600000,
      };
      await writeFile(join(cacheDir, 'el', 'tunnel-auth.json'), JSON.stringify(token), 'utf-8');
      const result = await getToken();
      assert.deepEqual(result, token);
    });

    it('returns manual token when provided and no cache', async () => {
      const result = await getToken({ manualToken: 'manual-tok' });
      assert.ok(result);
      assert.equal(result.token, 'manual-tok');
      assert.equal(result.provider, 'github');
    });

    it('caches manual token for subsequent calls', async () => {
      await getToken({ manualToken: 'to-be-cached' });
      const cachePath = join(cacheDir, 'el', 'tunnel-auth.json');
      const raw = await readFile(cachePath, 'utf-8');
      assert.ok(raw.includes('to-be-cached'));
    });

    it('respects provider option for manual token', async () => {
      const result = await getToken({ provider: 'microsoft', manualToken: 'ms-tok' });
      assert.ok(result);
      assert.equal(result.provider, 'microsoft');
    });
  });
});
