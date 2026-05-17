import type { AhpClient, JsonRpcError } from '../protocol/client.js';
import { getGhCliToken } from './tunnel-auth.js';

const GITHUB_COPILOT_RESOURCE = 'https://api.github.com';

export function isAuthRequiredError(err: unknown): err is JsonRpcError {
  return Boolean(
    err
      && typeof err === 'object'
      && 'code' in err
      && (err as { code?: unknown }).code === -32007,
  );
}

export async function getAgentHostBearerToken(env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  const envToken = env.EL_AGENT_HOST_TOKEN ?? env.GITHUB_TOKEN ?? env.GH_TOKEN;
  if (envToken?.trim()) {
    return envToken.trim();
  }
  return await getGhCliToken() ?? undefined;
}

export async function authenticateDefaultAgentHostResource(
  client: AhpClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const token = await getAgentHostBearerToken(env);
  if (!token) {
    return false;
  }
  await client.authenticate({
    resource: GITHUB_COPILOT_RESOURCE,
    token,
  });
  return true;
}

