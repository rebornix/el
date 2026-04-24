/**
 * Key handler for the tunnel list screen.
 * Follows the same pattern as session-list-key-model and folder-picker-key-model.
 */

type TunnelListKey = {
  escape: boolean;
  upArrow: boolean;
  downArrow: boolean;
  return: boolean;
  ctrl: boolean;
};

export type TunnelListAction =
  | { type: 'back' }
  | { type: 'move'; tunnelIndex: number }
  | { type: 'select'; tunnelIndex: number }
  | { type: 'noop' };

export function handleTunnelListKey(params: {
  key: TunnelListKey;
  input: string;
  tunnelIndex: number;
  tunnelCount: number;
  loading: boolean;
}): TunnelListAction {
  const { key, input, tunnelIndex, tunnelCount, loading } = params;

  if (key.escape) return { type: 'back' };

  if (loading) return { type: 'noop' };

  if (key.upArrow || (key.ctrl && input === 'p')) {
    return { type: 'move', tunnelIndex: Math.max(0, tunnelIndex - 1) };
  }

  if (key.downArrow || (key.ctrl && input === 'n')) {
    return { type: 'move', tunnelIndex: Math.min(Math.max(0, tunnelCount - 1), tunnelIndex + 1) };
  }

  if (key.return && tunnelCount > 0) {
    return { type: 'select', tunnelIndex };
  }

  return { type: 'noop' };
}
