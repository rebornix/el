import type { IDirectoryEntry } from '../protocol/types/index.js';
import { computeSelectionWindow } from './selection-window.js';

interface FolderDisplayEntry {
  name: string;
  display: string;
  isDir: boolean;
}

export function buildFolderDisplayEntries(entries: IDirectoryEntry[]): FolderDisplayEntry[] {
  const dirs = entries.filter((e) => e.type === 'directory').sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter((e) => e.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
  return [
    { name: '..', display: '..', isDir: true },
    ...dirs.map((d) => ({ name: d.name, display: `${d.name}/`, isDir: true })),
    ...files.map((f) => ({ name: f.name, display: f.name, isDir: false })),
  ];
}

export function computeFolderWindow(params: {
  displayEntries: FolderDisplayEntry[];
  selectedIndex: number;
  maxHeight?: number;
  windowRows?: number;
}) {
  const { displayEntries, selectedIndex, maxHeight, windowRows } = params;
  const FIXED_OVERHEAD = 5;
  const resolvedWindowRows = windowRows ?? (maxHeight ? Math.max(5, maxHeight - FIXED_OVERHEAD) : displayEntries.length);
  const totalItems = displayEntries.length;
  const window = computeSelectionWindow({
    totalItems,
    selectedIndex,
    windowSize: resolvedWindowRows,
  });
  return {
    startIdx: window.startIdx,
    endIdx: window.endIdx,
    hasAbove: window.hasAbove,
    hasBelow: window.hasBelow,
  };
}
