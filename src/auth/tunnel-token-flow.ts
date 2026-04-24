/**
 * Tunnel token acquisition flow — orchestrates cached lookup, device code auth, and caching.
 * Decoupled from TUI concerns: uses a callback for auth UI rather than writing to stdout.
 */

import {
  cacheToken,
  getToken,
  startDeviceCodeFlow,
  pollForDeviceCodeToken,
  type TunnelAuthProvider,
  type TunnelAuthToken,
  type DeviceCodeResponse,
} from './tunnel-auth.js';

export interface AuthViewState {
  title: string;
  lines: string[];
  statusMessage: string;
}

export function buildDeviceCodeAuthView(device: DeviceCodeResponse): AuthViewState {
  return {
    title: 'Authorize tunnel access',
    lines: [
      `1) Open: ${device.verification_uri}`,
      `2) Enter code: ${device.user_code}`,
    ],
    statusMessage: 'Waiting for authorization...',
  };
}

export async function acquireTunnelToken(
  options?: { tunnelToken?: string; tunnelAuth?: TunnelAuthProvider },
  onAuthView?: (view: AuthViewState | undefined) => void,
): Promise<TunnelAuthToken | null> {
  const provider = options?.tunnelAuth ?? 'github';
  const token = await getToken({ provider, manualToken: options?.tunnelToken });
  if (token || provider !== 'github') return token;

  const device = await startDeviceCodeFlow();
  const authView = buildDeviceCodeAuthView(device);

  if (onAuthView) {
    onAuthView(authView);
  } else {
    process.stdout.write(`\n${authView.title}:\n`);
    for (const line of authView.lines) {
      process.stdout.write(`${line}\n`);
    }
    process.stdout.write('\n');
  }

  const accessToken = await pollForDeviceCodeToken(
    device.device_code,
    device.interval,
    device.expires_in,
  );

  const resolved: TunnelAuthToken = {
    token: accessToken,
    provider,
  };
  await cacheToken(resolved);
  return resolved;
}
