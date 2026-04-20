import type { SessionInputKey } from './session-key-handler.js';

type SessionListKey = Pick<SessionInputKey, 'return' | 'upArrow' | 'downArrow'>;

type SessionListAction =
  | { type: 'move'; selectedIndex: number }
  | { type: 'create' }
  | { type: 'select'; selectedIndex: number }
  | { type: 'noop' };

export function handleSessionListKey(params: {
  key: SessionListKey;
  selectedIndex: number;
  totalItems: number;
}): SessionListAction {
  const { key, selectedIndex, totalItems } = params;

  if (key.upArrow) {
    return { type: 'move', selectedIndex: Math.max(0, selectedIndex - 1) };
  }
  if (key.downArrow) {
    return { type: 'move', selectedIndex: Math.min(totalItems - 1, selectedIndex + 1) };
  }
  if (key.return) {
    if (selectedIndex === 0) return { type: 'create' };
    return { type: 'select', selectedIndex };
  }

  return { type: 'noop' };
}
