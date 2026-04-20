import type { IRootState } from '../protocol/types/index.js';

export function getCreateSessionAgents(rootState: IRootState | null) {
  return rootState?.agents ?? [];
}

export function nextCreateSessionIndex(current: number, dir: 'up' | 'down', total: number) {
  if (total <= 0) return 0;
  if (dir === 'up') return Math.max(0, current - 1);
  return Math.min(total - 1, current + 1);
}
