import { describe, expect, it } from "vitest";
import { moveLeft, moveRight, moveUp, moveDown, type NavState } from "./navigation.js";
import type { KanbanColumns } from "./kanban.js";

function makeColumns(counts: [number, number, number, number]): KanbanColumns {
  const makeIssues = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      title: `Issue ${i + 1}`,
      status: "ready" as const,
      sprint: "s",
      createdAt: "",
      updatedAt: "",
      hasSpec: false,
      hasLog: false,
    }));
  return {
    idea: makeIssues(counts[0]),
    ready: makeIssues(counts[1]),
    doing: makeIssues(counts[2]),
    done: makeIssues(counts[3]),
  };
}

describe("keyboard navigation", () => {
  const col0: NavState = { colIndex: 0, rowIndex: 0 };

  it("moveRight advances column", () => {
    const cols = makeColumns([1, 1, 1, 1]);
    expect(moveRight(col0, cols).colIndex).toBe(1);
  });

  it("moveRight clamps at last column", () => {
    const cols = makeColumns([1, 1, 1, 1]);
    const at3: NavState = { colIndex: 3, rowIndex: 0 };
    expect(moveRight(at3, cols).colIndex).toBe(3);
  });

  it("moveLeft retreats column", () => {
    const cols = makeColumns([1, 1, 1, 1]);
    const at2: NavState = { colIndex: 2, rowIndex: 0 };
    expect(moveLeft(at2, cols).colIndex).toBe(1);
  });

  it("moveLeft clamps at column 0", () => {
    const cols = makeColumns([1, 1, 1, 1]);
    expect(moveLeft(col0, cols).colIndex).toBe(0);
  });

  it("moveDown advances row within column", () => {
    const cols = makeColumns([0, 3, 0, 0]);
    const state: NavState = { colIndex: 1, rowIndex: 0 };
    expect(moveDown(state, cols).rowIndex).toBe(1);
  });

  it("moveDown clamps at last card", () => {
    const cols = makeColumns([0, 2, 0, 0]);
    const state: NavState = { colIndex: 1, rowIndex: 1 };
    expect(moveDown(state, cols).rowIndex).toBe(1);
  });

  it("moveDown on an empty column returns rowIndex 0, not -1", () => {
    const cols = makeColumns([1, 0, 0, 0]);
    const state: NavState = { colIndex: 1, rowIndex: 0 };
    expect(moveDown(state, cols).rowIndex).toBe(0);
  });

  it("moveUp retreats row", () => {
    const cols = makeColumns([0, 2, 0, 0]);
    const state: NavState = { colIndex: 1, rowIndex: 1 };
    expect(moveUp(state, cols).rowIndex).toBe(0);
  });

  it("moveRight resets rowIndex to 0 when column has fewer cards", () => {
    const cols = makeColumns([0, 3, 1, 0]);
    const state: NavState = { colIndex: 1, rowIndex: 2 };
    const next = moveRight(state, cols);
    expect(next.colIndex).toBe(2);
    expect(next.rowIndex).toBe(0);
  });
});
