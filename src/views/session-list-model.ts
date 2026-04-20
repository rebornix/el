import type { IRootState, ISessionSummary } from '../protocol/types/index.js';

interface SessionListWindow {
  totalItems: number;
  startIdx: number;
  endIdx: number;
  windowSize: number;
  hasAbove: boolean;
  hasBelow: boolean;
}

export function computeSessionListWindow(params: {
  sessions: ISessionSummary[];
  rootState: IRootState | null;
  selectedIndex: number;
  terminalRows: number;
}): SessionListWindow {
  const { sessions, rootState, selectedIndex, terminalRows } = params;

  const totalItems = sessions.length + 1;
  const agentRows = rootState && rootState.agents.length > 0 ? rootState.agents.length + 2 : 0;
  const FIXED_OVERHEAD = 9;
  const windowSize = Math.max(5, terminalRows - FIXED_OVERHEAD - agentRows);

  const halfWindow = Math.floor(windowSize / 2);
  let startIdx = Math.max(0, selectedIndex - halfWindow);
  const endIdx = Math.min(totalItems, startIdx + windowSize);

  if (endIdx - startIdx < windowSize) {
    startIdx = Math.max(0, endIdx - windowSize);
  }

  return {
    totalItems,
    startIdx,
    endIdx,
    windowSize,
    hasAbove: startIdx > 0,
    hasBelow: endIdx < totalItems,
  };
}
