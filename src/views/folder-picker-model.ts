import type { IDirectoryEntry } from '../protocol/types/index.js';

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
}) {
  const { displayEntries, selectedIndex, maxHeight } = params;
  const FIXED_OVERHEAD = 5;
  const windowSize = maxHeight ? Math.max(5, maxHeight - FIXED_OVERHEAD) : displayEntries.length;
  const totalItems = displayEntries.length;
  const halfWindow = Math.floor(windowSize / 2);
  let startIdx = Math.max(0, selectedIndex - halfWindow);
  const endIdx = Math.min(totalItems, startIdx + windowSize);
  if (endIdx - startIdx < windowSize) startIdx = Math.max(0, endIdx - windowSize);
  return {
    startIdx,
    endIdx,
    hasAbove: startIdx > 0,
    hasBelow: endIdx < totalItems,
  };
}
