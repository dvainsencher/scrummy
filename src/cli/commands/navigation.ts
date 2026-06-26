import type { IssueStatus } from "../../domain/types.js";
import { ISSUE_STATUSES } from "../../domain/types.js";
import type { KanbanColumns } from "./kanban.js";

export interface NavState {
  colIndex: number;
  rowIndex: number;
}

function colIssueCount(columns: KanbanColumns, colIndex: number): number {
  const status = ISSUE_STATUSES[colIndex] as IssueStatus | undefined;
  if (!status) return 0;
  return columns[status].length;
}

export function moveRight(state: NavState, columns: KanbanColumns): NavState {
  const nextCol = Math.min(ISSUE_STATUSES.length - 1, state.colIndex + 1);
  const maxRow = Math.max(0, colIssueCount(columns, nextCol) - 1);
  return { colIndex: nextCol, rowIndex: Math.min(state.rowIndex, maxRow) };
}

export function moveLeft(state: NavState, columns: KanbanColumns): NavState {
  const nextCol = Math.max(0, state.colIndex - 1);
  const maxRow = Math.max(0, colIssueCount(columns, nextCol) - 1);
  return { colIndex: nextCol, rowIndex: Math.min(state.rowIndex, maxRow) };
}

export function moveDown(state: NavState, columns: KanbanColumns): NavState {
  const count = colIssueCount(columns, state.colIndex);
  if (count === 0) return state;
  return { ...state, rowIndex: Math.min(count - 1, state.rowIndex + 1) };
}

export function moveUp(state: NavState, _columns: KanbanColumns): NavState {
  return { ...state, rowIndex: Math.max(0, state.rowIndex - 1) };
}
