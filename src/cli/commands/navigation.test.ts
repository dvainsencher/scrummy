import { describe, expect, it } from "vitest";
import { moveLeft, moveRight, moveUp, moveDown, clampScroll, type NavState } from "./navigation.js";

describe("keyboard navigation", () => {
  const col0: NavState = { colIndex: 0, rowIndex: 0 };

  it("moveRight advances column", () => {
    expect(moveRight(col0, [1, 1, 1, 1]).colIndex).toBe(1);
  });

  it("moveRight is a no-op when already at the rightmost non-empty column", () => {
    const at3: NavState = { colIndex: 3, rowIndex: 0 };
    expect(moveRight(at3, [1, 1, 1, 1]).colIndex).toBe(3);
  });

  it("moveLeft retreats column", () => {
    const at2: NavState = { colIndex: 2, rowIndex: 0 };
    expect(moveLeft(at2, [1, 1, 1, 1]).colIndex).toBe(1);
  });

  it("moveLeft is a no-op when already at the leftmost non-empty column", () => {
    expect(moveLeft(col0, [1, 1, 1, 1]).colIndex).toBe(0);
  });

  it("works for a board with three columns", () => {
    const at2: NavState = { colIndex: 2, rowIndex: 0 };
    expect(moveRight(at2, [1, 1, 1]).colIndex).toBe(2);
    expect(moveLeft(at2, [1, 1, 1]).colIndex).toBe(1);
  });

  it("moveDown advances row within column", () => {
    const state: NavState = { colIndex: 1, rowIndex: 0 };
    expect(moveDown(state, [0, 3, 0, 0]).rowIndex).toBe(1);
  });

  it("moveDown clamps at last card", () => {
    const state: NavState = { colIndex: 1, rowIndex: 1 };
    expect(moveDown(state, [0, 2, 0, 0]).rowIndex).toBe(1);
  });

  it("moveDown on an empty column returns rowIndex 0, not -1", () => {
    const state: NavState = { colIndex: 1, rowIndex: 0 };
    expect(moveDown(state, [1, 0, 0, 0]).rowIndex).toBe(0);
  });

  it("moveUp retreats row", () => {
    const state: NavState = { colIndex: 1, rowIndex: 1 };
    expect(moveUp(state, [0, 2, 0, 0]).rowIndex).toBe(0);
  });

  it("moveRight always resets rowIndex to 0 on the target column", () => {
    const state: NavState = { colIndex: 1, rowIndex: 2 };
    const next = moveRight(state, [0, 3, 1, 0]);
    expect(next.colIndex).toBe(2);
    expect(next.rowIndex).toBe(0);
  });

  it("moveRight skips empty columns to land on the first non-empty one", () => {
    // col 1 → col 2 is empty, col 3 has cards
    const state: NavState = { colIndex: 1, rowIndex: 0 };
    const next = moveRight(state, [0, 2, 0, 1]);
    expect(next.colIndex).toBe(3);
    expect(next.rowIndex).toBe(0);
  });

  it("moveRight is a no-op when all columns to the right are empty", () => {
    const state: NavState = { colIndex: 1, rowIndex: 0 };
    const next = moveRight(state, [0, 2, 0, 0]);
    expect(next.colIndex).toBe(1);
    expect(next.rowIndex).toBe(0);
  });

  it("moveLeft skips empty columns to land on the first non-empty one to the left", () => {
    // col 3 → col 2 is empty, col 1 has cards
    const state: NavState = { colIndex: 3, rowIndex: 0 };
    const next = moveLeft(state, [0, 1, 0, 2]);
    expect(next.colIndex).toBe(1);
    expect(next.rowIndex).toBe(0);
  });

  it("moveLeft is a no-op when all columns to the left are empty", () => {
    const state: NavState = { colIndex: 2, rowIndex: 0 };
    const next = moveLeft(state, [0, 0, 3, 1]);
    expect(next.colIndex).toBe(2);
    expect(next.rowIndex).toBe(0);
  });
});

describe("clampScroll", () => {
  it("returns offset unchanged when rowIndex is within view", () => {
    expect(clampScroll(0, 1, 3)).toBe(0);
    expect(clampScroll(2, 3, 3)).toBe(2);
  });

  it("scrolls down to reveal rowIndex when it is past the bottom of the viewport", () => {
    expect(clampScroll(0, 3, 2)).toBe(2); // offset shifts so row 3 sits at the bottom
    expect(clampScroll(0, 5, 3)).toBe(3);
  });

  it("scrolls up to reveal rowIndex when it is above the top of the viewport", () => {
    expect(clampScroll(3, 1, 2)).toBe(1); // offset jumps up to row 1
    expect(clampScroll(5, 2, 3)).toBe(2);
  });

  it("clamps to 0 when rowIndex is 0", () => {
    expect(clampScroll(0, 0, 5)).toBe(0);
  });
});
