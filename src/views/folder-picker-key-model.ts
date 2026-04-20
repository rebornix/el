import type { URI } from '../protocol/types/index.js';
import { childUri, parentUri } from '../uri-helpers.js';
import type { SessionInputKey } from './session-key-handler.js';

type FolderPickerKey = Pick<SessionInputKey, 'escape' | 'upArrow' | 'downArrow' | 'tab' | 'return'>;

type FolderPickerAction =
  | { type: 'back' }
  | { type: 'move'; selectedIndex: number }
  | { type: 'select-current' }
  | { type: 'navigate'; uri: URI }
  | { type: 'noop' };

export function handleFolderPickerKey(params: {
  key: FolderPickerKey;
  selectedIdx: number;
  totalEntries: number;
  loading: boolean;
  currentUri: URI;
  sortedDirs: { name: string }[];
}): FolderPickerAction {
  const { key, selectedIdx, totalEntries, loading, currentUri, sortedDirs } = params;

  if (key.escape) return { type: 'back' };
  if (key.upArrow) return { type: 'move', selectedIndex: Math.max(0, selectedIdx - 1) };
  if (key.downArrow) return { type: 'move', selectedIndex: Math.min(totalEntries - 1, selectedIdx + 1) };
  if (key.tab) return { type: 'select-current' };

  if (key.return && !loading) {
    if (selectedIdx === 0) {
      return { type: 'navigate', uri: parentUri(currentUri) };
    }
    if (selectedIdx <= sortedDirs.length) {
      const dir = sortedDirs[selectedIdx - 1];
      if (dir) return { type: 'navigate', uri: childUri(currentUri, dir.name) };
    }
  }

  return { type: 'noop' };
}
