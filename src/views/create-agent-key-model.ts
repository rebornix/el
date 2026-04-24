/**
 * Key handler for the create-agent screen.
 * Follows the same pattern as session-list-key-model and folder-picker-key-model.
 */

type CreateAgentKey = Pick<
  { escape: boolean; upArrow: boolean; downArrow: boolean; return: boolean },
  'escape' | 'upArrow' | 'downArrow' | 'return'
>;

export type CreateAgentAction =
  | { type: 'back' }
  | { type: 'move'; providerIndex: number }
  | { type: 'confirm' }
  | { type: 'noop' };

export function handleCreateAgentKey(params: {
  key: CreateAgentKey;
  providerIndex: number;
  providerCount: number;
}): CreateAgentAction {
  const { key, providerIndex, providerCount } = params;

  if (key.escape) return { type: 'back' };

  if (key.upArrow) {
    return { type: 'move', providerIndex: Math.max(0, providerIndex - 1) };
  }
  if (key.downArrow) {
    return { type: 'move', providerIndex: Math.min(Math.max(0, providerCount - 1), providerIndex + 1) };
  }

  if (key.return) return { type: 'confirm' };

  return { type: 'noop' };
}
