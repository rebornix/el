import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** Supported authentication providers for Dev Tunnels. */
export type TunnelAuthProvider = 'github' | 'microsoft';

export interface TunnelAuthToken {
  token: string;
  provider: TunnelAuthProvider;
  expiresAt?: number; // epoch ms
}

/**
 * GitHub OAuth App client ID used by VS Code's GitHub authentication.
 * Dev Tunnels validates tokens against this client, so we must use the
 * same app for device code flow.
 */
const GITHUB_CLIENT_ID = '01ab8ac9400c4e429b23';

/** Scopes required by Dev Tunnels (matches VS Code's tunnelApplicationConfig). */
const GITHUB_SCOPES = 'user:email read:org';

/** Response from GitHub's POST /login/device/code endpoint. */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Return the path to the tunnel auth cache file.
 * Respects XDG_CONFIG_HOME when set.
 */
function getCachePath(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'el', 'tunnel-auth.json');
}

/**
 * Load a cached token from disk.
 * Returns `null` when no cache exists or the token has expired.
 */
export async function loadCachedToken(): Promise<TunnelAuthToken | null> {
  try {
    const raw = await readFile(getCachePath(), 'utf-8');
    const cached = JSON.parse(raw) as TunnelAuthToken;
    if (cached.expiresAt && Date.now() >= cached.expiresAt) {
      return null; // expired
    }
    return cached;
  } catch (err: unknown) {
    // ENOENT = no cache file, which is expected on first run
    if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // SyntaxError = corrupt JSON — treat as missing cache
    if (err instanceof SyntaxError) {
      return null;
    }
    // Re-throw real errors (permissions, disk full, etc.)
    throw err;
  }
}

/**
 * Persist a token to the cache file, creating parent directories if needed.
 */
export async function cacheToken(token: TunnelAuthToken): Promise<void> {
  const path = getCachePath();
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(token, null, 2), 'utf-8');
}

/**
 * Try to get a GitHub token via `gh auth token`.
 * Returns `null` when the `gh` CLI is not installed or not authenticated.
 *
 * NOTE: gh CLI tokens use a different OAuth App than Dev Tunnels expects.
 * They will NOT work for tunnel listing/connection. This function is kept
 * for potential future use but is not called in the default auth flow.
 */
export function getGhCliToken(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('gh', ['auth', 'token'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Start the GitHub device code flow.
 *
 * Returns a DeviceCodeResponse containing the user_code and verification_uri
 * that the user must visit. Call `pollForDeviceCodeToken()` to wait for the
 * user to complete authorization.
 */
export async function startDeviceCodeFlow(): Promise<DeviceCodeResponse> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `client_id=${GITHUB_CLIENT_ID}&scope=${encodeURIComponent(GITHUB_SCOPES)}`,
  });
  if (!res.ok) {
    throw new Error(`GitHub device code request failed: ${res.status} ${await res.text()}`);
  }
  return await res.json() as DeviceCodeResponse;
}

/**
 * Poll GitHub for a device code access token.
 *
 * Polls every `interval` seconds (from the DeviceCodeResponse) until the user
 * authorizes or the code expires. Returns the access token on success.
 *
 * @param deviceCode - The device_code from startDeviceCodeFlow()
 * @param interval - Polling interval in seconds
 * @param expiresIn - Code lifetime in seconds
 * @param signal - Optional AbortSignal for cancellation
 */
export async function pollForDeviceCodeToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  signal?: AbortSignal,
): Promise<string> {
  const maxAttempts = Math.floor(expiresIn / interval);

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    if (signal?.aborted) {
      throw new Error('Device code flow cancelled');
    }

    let res: Response;
    try {
      res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${GITHUB_CLIENT_ID}&device_code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      });
    } catch {
      continue; // network error, retry
    }

    if (!res.ok) continue;

    const json = await res.json() as { access_token?: string; error?: string };

    if (json.error === 'authorization_pending') {
      continue;
    }
    if (json.error === 'slow_down') {
      // Server wants us to slow down — add 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    if (json.error) {
      throw new Error(`GitHub auth error: ${json.error}`);
    }
    if (json.access_token) {
      return json.access_token;
    }
  }

  throw new Error('Device code expired — please try again');
}

/**
 * Obtain a tunnel auth token using the tiered strategy:
 *
 * 1. Cached token on disk (from a previous device code flow)
 * 2. Manual token (--tunnel-token CLI flag)
 * 3. Returns null — caller should initiate device code flow via TUI
 *
 * NOTE: gh CLI tokens are NOT used because they come from a different
 * OAuth App than what Dev Tunnels expects. The device code flow (step 3)
 * uses VS Code's GitHub OAuth App client ID which Dev Tunnels trusts.
 */
export async function getToken(options?: {
  provider?: TunnelAuthProvider;
  manualToken?: string;
}): Promise<TunnelAuthToken | null> {
  const provider = options?.provider ?? 'github';

  // 1. Check cache
  const cached = await loadCachedToken();
  if (cached) return cached;

  // 2. Manual token (CLI escape hatch)
  if (options?.manualToken) {
    const tok: TunnelAuthToken = { token: options.manualToken, provider };
    await cacheToken(tok);
    return tok;
  }

  // 3. No cached or manual token — caller must initiate device code flow
  return null;
}

/**
 * Build the `Authorization` header value for the given token.
 * Dev Tunnels expects `github <token>` or `Bearer <token>` (AAD).
 */
export function authorizationHeader(token: TunnelAuthToken): string {
  return token.provider === 'github' ? `github ${token.token}` : `Bearer ${token.token}`;
}
