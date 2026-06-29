import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { act } from "react";
import React from "react";
import { SprintBoard, computeSprintLayout } from "./sprintBoard.js";
import type { IssueView, SprintGroup } from "../../reader/plan.js";

function makeIssue(id: number, status: IssueView["status"]): IssueView {
  return {
    id,
    title: `Issue ${id}`,
    status,
    sprint: "s",
    createdAt: "",
    updatedAt: "",
    hasSpec: false,
    hasLog: false,
  };
}

function makeSprint(overrides: Partial<SprintGroup> & { name: string }): SprintGroup {
  return {
    position: 10,
    status: "active",
    goal: "",
    notes: "",
    active: true,
    issues: [],
    ...overrides,
  };
}

const sprints: SprintGroup[] = [
  makeSprint({
    name: "active-one",
    status: "active",
    active: true,
    goal: "ship the thing",
    issues: [makeIssue(1, "done"), makeIssue(2, "doing")],
  }),
  makeSprint({ name: "planned-one", status: "planned", active: false, position: 20 }),
  makeSprint({ name: "done-one", status: "done", active: false, position: 5 }),
];

// Generous terminal so every column's single card fits without scrolling.
const big = { rows: 40, cols: 150 };

describe("computeSprintLayout", () => {
  it("derives an exact maxVisible from terminal height", () => {
    expect(computeSprintLayout(40, 150).maxVisible).toBe(5); // floor((40-7-2)/6)
    expect(computeSprintLayout(24, 150).maxVisible).toBe(2); // floor((24-7-2)/6)
  });

  it("never returns maxVisible below 1, even on a tiny terminal", () => {
    expect(computeSprintLayout(8, 150).maxVisible).toBe(1);
  });

  it("splits the terminal width across three columns", () => {
    const { columnWidth, cardWidth } = computeSprintLayout(40, 150);
    expect(columnWidth).toBe(49); // floor(150/3) - 1 gap
    expect(cardWidth).toBe(47);
  });

  it("clamps column width up on a narrow terminal", () => {
    expect(computeSprintLayout(40, 30).columnWidth).toBe(16); // MIN_COL_WIDTH
  });
});

describe("SprintBoard", () => {
  it("renders three state columns and every sprint", () => {
    const { lastFrame } = render(
      <SprintBoard sprints={sprints} selected={null} rows={big.rows} cols={big.cols} onSelect={() => {}} onCancel={() => {}} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("ACTIVE");
    expect(frame).toContain("PLANNED");
    expect(frame).toContain("DONE");
    expect(frame).toContain("active-one");
    expect(frame).toContain("planned-one");
    expect(frame).toContain("done-one");
  });

  it("never renders wider or taller than the terminal", () => {
    const { lastFrame } = render(
      <SprintBoard sprints={sprints} selected={null} rows={24} cols={80} onSelect={() => {}} onCancel={() => {}} />,
    );
    const lines = (lastFrame() ?? "").split("\n");
    expect(lines.length).toBeLessThanOrEqual(24);
    for (const line of lines) {
      // strip ANSI colour codes (ESC + "[..m") so we measure visual width
      // eslint-disable-next-line no-control-regex
      expect(line.replace(/\x1b\[[0-9;]*m/g, "").length).toBeLessThanOrEqual(80);
    }
  });

  it("keeps the header visible and scrolls a tall column instead of overflowing", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeSprint({ name: `done-${i}`, status: "done", active: false, position: i, issues: [makeIssue(i, "done")] }),
    );
    const { lastFrame } = render(
      <SprintBoard sprints={many} selected={null} rows={24} cols={90} onSelect={() => {}} onCancel={() => {}} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("scrummy sprints"); // header not scrolled off
    expect(frame).toMatch(/more/); // a "↓ N more" scroll indicator is shown
    expect((frame.match(/done-\d/g) ?? []).length).toBeLessThan(10); // not all rendered at once
  });

  it("shows each sprint's done/total progress and goal", () => {
    const { lastFrame } = render(
      <SprintBoard sprints={sprints} selected={null} rows={big.rows} cols={big.cols} onSelect={() => {}} onCancel={() => {}} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("1/2 done");
    expect(frame).toContain("ship the thing");
  });

  it("opens the focused sprint on Enter", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <SprintBoard sprints={sprints} selected={null} rows={big.rows} cols={big.cols} onSelect={onSelect} onCancel={() => {}} />,
    );
    // Cursor starts on the leftmost card (planned column is first).
    act(() => stdin.write("\r"));
    expect(onSelect).toHaveBeenCalledWith("planned-one");
  });

  it("moves selection across columns and opens the right sprint", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <SprintBoard sprints={sprints} selected={null} rows={big.rows} cols={big.cols} onSelect={onSelect} onCancel={() => {}} />,
    );
    act(() => stdin.write("\x1B[C")); // right arrow → active column
    act(() => stdin.write("\r"));
    expect(onSelect).toHaveBeenCalledWith("active-one");
  });

  it("shows a cancel hint", () => {
    const { lastFrame } = render(
      <SprintBoard sprints={sprints} selected={null} rows={big.rows} cols={big.cols} onSelect={() => {}} onCancel={() => {}} />,
    );
    expect(lastFrame() ?? "").toMatch(/esc/i);
  });

  it("cursor always starts on the leftmost card regardless of selected prop", () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      // selected="active-one" is in the second column; cursor should still open on planned-one (col 0).
      <SprintBoard sprints={sprints} selected="active-one" rows={big.rows} cols={big.cols} onSelect={onSelect} onCancel={() => {}} />,
    );
    act(() => stdin.write("\r"));
    expect(onSelect).toHaveBeenCalledWith("planned-one");
  });
});
