import type { IRootState, ISessionSummary } from '../protocol/types/index.js';
import { computeSelectionWindow } from './selection-window.js';

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
  hasStatus?: boolean;
  windowRows?: number;
}): SessionListWindow {
  const {
    sessions,
    rootState,
    selectedIndex,
    terminalRows,
    hasStatus = false,
    windowRows,
  } = params;

  const totalItems = sessions.length + 1;
  const agentRows = rootState && rootState.agents.length > 0 ? rootState.agents.length + 2 : 0;
  const FIXED_OVERHEAD = 5 + (hasStatus ? 1 : 0);
  const resolvedWindowRows = windowRows ?? Math.max(5, terminalRows - FIXED_OVERHEAD - agentRows);
  const window = computeSelectionWindow({
    totalItems,
    selectedIndex,
    windowSize: resolvedWindowRows,
  });

  return {
    totalItems,
    startIdx: window.startIdx,
    endIdx: window.endIdx,
    windowSize: resolvedWindowRows,
    hasAbove: window.hasAbove,
    hasBelow: window.hasBelow,
  };
}
