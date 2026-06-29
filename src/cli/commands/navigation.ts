export interface NavState {
  colIndex: number;
  rowIndex: number;
}

/**
 * Column-agnostic keyboard navigation. `counts[i]` is the number of selectable rows
 * in column `i`. Works for any board — the issue board (4 status columns) and the
 * sprint board (3 state columns) both drive it with their own per-column counts.
 */
export function moveRight(state: NavState, counts: number[]): NavState {
  for (let c = state.colIndex + 1; c < counts.length; c++) {
    if ((counts[c] ?? 0) > 0) return { colIndex: c, rowIndex: 0 };
  }
  return state;
}

export function moveLeft(state: NavState, counts: number[]): NavState {
  for (let c = state.colIndex - 1; c >= 0; c--) {
    if ((counts[c] ?? 0) > 0) return { colIndex: c, rowIndex: 0 };
  }
  return state;
}

export function moveDown(state: NavState, counts: number[]): NavState {
  const count = counts[state.colIndex] ?? 0;
  if (count === 0) return state;
  return { ...state, rowIndex: Math.min(count - 1, state.rowIndex + 1) };
}

export function moveUp(state: NavState, _counts: number[]): NavState {
  return { ...state, rowIndex: Math.max(0, state.rowIndex - 1) };
}

/**
 * Scroll-offset that keeps `rowIndex` inside the visible window of `maxVisible` rows.
 * Shared by every scrolling board so the selected card is always on screen.
 */
export function clampScroll(offset: number, rowIndex: number, maxVisible: number): number {
  if (rowIndex < offset) return rowIndex;
  if (rowIndex >= offset + maxVisible) return rowIndex - maxVisible + 1;
  return offset;
}
