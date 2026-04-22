export function computeSelectionWindow(params: {
  totalItems: number;
  selectedIndex: number;
  windowSize: number;
}) {
  const { totalItems, selectedIndex } = params;
  const windowSize = Math.max(1, params.windowSize);
  const halfWindow = Math.floor(windowSize / 2);
  let startIdx = Math.max(0, selectedIndex - halfWindow);
  const endIdx = Math.min(totalItems, startIdx + windowSize);

  if (endIdx - startIdx < windowSize) {
    startIdx = Math.max(0, endIdx - windowSize);
  }

  return {
    startIdx,
    endIdx,
    hasAbove: startIdx > 0,
    hasBelow: endIdx < totalItems,
  };
}
