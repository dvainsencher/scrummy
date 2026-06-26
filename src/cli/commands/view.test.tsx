import { describe, expect, it, beforeAll } from "vitest";
import { render } from "ink-testing-library";
import { act } from "react";
import React from "react";

// Required for act() to work in a non-DOM test environment (ink uses react-reconciler)
beforeAll(() => { (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; });
import { KanbanApp, clampScroll } from "./view.js";
import type { KanbanData } from "./kanban.js";

function makeData(overrides: Partial<KanbanData> = {}): KanbanData {
  return {
    sprintName: null,
    columns: { idea: [], ready: [], doing: [], done: [] },
    allSprints: [],
    ...overrides,
  };
}

describe("KanbanApp", () => {
  it("renders four status column headers", () => {
    const { lastFrame } = render(<KanbanApp data={makeData()} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("IDEA");
    expect(frame).toContain("READY");
    expect(frame).toContain("DOING");
    expect(frame).toContain("DONE");
  });

  it("renders the active sprint name in the header", () => {
    const { lastFrame } = render(<KanbanApp data={makeData({ sprintName: "my-sprint" })} />);
    expect(lastFrame() ?? "").toContain("my-sprint");
  });

  it("renders issue cards with id and title", () => {
    const issues = [
      { id: 1, title: "Build it", status: "ready" as const, sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false },
      { id: 2, title: "Test it", status: "doing" as const, sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false },
    ];
    const data = makeData({ sprintName: "s1", columns: { idea: [], ready: [issues[0]], doing: [issues[1]], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("#1");
    expect(frame).toContain("Build it");
    expect(frame).toContain("#2");
    expect(frame).toContain("Test it");
  });

  it("shows spec indicator S when issue has spec", () => {
    const issues = [
      { id: 3, title: "Speced", status: "ready" as const, sprint: "s1", createdAt: "", updatedAt: "", hasSpec: true, hasLog: false },
    ];
    const data = makeData({ columns: { idea: [], ready: issues, doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    expect(lastFrame() ?? "").toContain("S");
  });

  it("shows log indicator L when issue has log", () => {
    const issues = [
      { id: 4, title: "Logged", status: "doing" as const, sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: true },
    ];
    const data = makeData({ columns: { idea: [], ready: [], doing: issues, done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    expect(lastFrame() ?? "").toContain("L");
  });

  it("renders issues in the done column", () => {
    const issue = { id: 99, title: "Shipped", status: "done" as const, sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false };
    const data = makeData({ columns: { idea: [], ready: [], doing: [], done: [issue] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("#99");
    expect(frame).toContain("Shipped");
  });

  it("shows down-scroll indicator when column has more issues than maxVisibleCards", () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1, title: `Issue ${i + 1}`, status: "idea" as const,
      sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    }));
    const data = makeData({ columns: { idea: issues, ready: [], doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} maxVisibleCards={2} />);
    expect(lastFrame() ?? "").toMatch(/↓.*more/);
  });

  it("triggers scroll when 3 sprint issues are present without explicit maxVisibleCards (CARD_HEIGHT must account for sprint line)", () => {
    // All cards render 7 lines: border-top, id/status, title, sprint-name, indicators, border-bottom, margin.
    // The test mock has no stdout.rows, so terminalRows falls back to 24 and
    // maxVisible = floor((24 - FIXED_ROWS) / CARD_HEIGHT). If CARD_HEIGHT=5 (wrong), maxVisible=3
    // and 3 issues fit without scrolling — but the 3rd card overflows the terminal and ink clips it,
    // causing the selection to go off-screen without the board scrolling (#66).
    // CARD_HEIGHT=7 → maxVisible=2, so 3 sprint issues require a scroll indicator.
    const issues = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1, title: `Issue ${i + 1}`, status: "idea" as const,
      sprint: "current-sprint", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    }));
    const data = makeData({ columns: { idea: issues, ready: [], doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    expect(lastFrame() ?? "").toMatch(/↓.*more/);
  });

  it("triggers scroll when 2 indicator-bearing sprint issues are present without explicit maxVisibleCards (CARD_HEIGHT must account for indicators)", () => {
    // Issues with hasSpec or hasLog render 7 lines: border-top, id/status, title, sprint-name,
    // indicators, border-bottom, margin. CARD_HEIGHT must be 7 so maxVisible is not overestimated.
    // If CARD_HEIGHT=6, maxVisible=2 but each card needs 7 lines; with a 24-row terminal
    // (17 available) two 7-line cards = 14 lines which fits, so this test requires 3 such issues.
    // If CARD_HEIGHT=6 on a 40-row terminal, maxVisible=5 but 5×7=35+7=42>40 — the 5th card
    // overflows and clampScroll silently thinks it is in view, breaking scroll-to-selected.
    const issues = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1, title: `Issue ${i + 1}`, status: "idea" as const,
      sprint: "current-sprint", createdAt: "", updatedAt: "", hasSpec: true, hasLog: false,
    }));
    const data = makeData({ columns: { idea: issues, ready: [], doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    expect(lastFrame() ?? "").toMatch(/↓.*more/);
  });

  it("shows up-scroll indicator and hides scrolled-past issues when scrollOffset > 0", () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1, title: `Issue ${i + 1}`, status: "idea" as const,
      sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    }));
    const data = makeData({ columns: { idea: issues, ready: [], doing: [], done: [] } });
    // scrollOffset=2 means rows 0 and 1 are hidden above the viewport
    const { lastFrame } = render(<KanbanApp data={data} maxVisibleCards={2} initialScrollOffsets={[2, 0, 0, 0]} />);
    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/↑.*more/);
    expect(frame).not.toContain("Issue 1");
    expect(frame).not.toContain("Issue 2");
  });

  it("scrolls board when navigating down past the visible window", () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1, title: `Issue ${i + 1}`, status: "idea" as const,
      sprint: "s1", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    }));
    const data = makeData({ columns: { idea: issues, ready: [], doing: [], done: [] } });
    const { lastFrame, stdin } = render(<KanbanApp data={data} maxVisibleCards={2} />);

    // Initial state: issues 1 and 2 visible, issue 3 and 4 below fold
    expect(lastFrame() ?? "").toContain("Issue 1");
    expect(lastFrame() ?? "").toContain("Issue 2");
    expect(lastFrame() ?? "").not.toContain("Issue 3");

    // Navigate to row 1 (still in view) — act() flushes React between presses
    act(() => stdin.write("\x1B[B"));
    expect(lastFrame() ?? "").toContain("Issue 1");

    // Navigate to row 2 — outside the window, board must scroll
    act(() => stdin.write("\x1B[B"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Issue 3");   // now visible
    expect(frame).not.toContain("Issue 1"); // scrolled past
  });

  it("triggers scroll for 3 backlog cards (sprint='', no indicators) — sprint || placeholder must render to keep CARD_HEIGHT=7", () => {
    // Backlog cards have sprint="" and no indicators. With the buggy ?? operator,
    // the sprint row rendered empty text (0 height in Ink), shrinking cards to 6 lines
    // and causing maxVisible to be overestimated — same overflow bug as before.
    const issues = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1, title: `Issue ${i + 1}`, status: "idea" as const,
      sprint: "", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    }));
    const data = makeData({ columns: { idea: issues, ready: [], doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} />);
    expect(lastFrame() ?? "").toMatch(/↓.*more/);
  });
});

describe("clampScroll", () => {
  it("returns offset unchanged when rowIndex is within view", () => {
    expect(clampScroll(0, 1, 3)).toBe(0);
    expect(clampScroll(2, 3, 3)).toBe(2);
  });

  it("scrolls down to reveal rowIndex when it is past the bottom of viewport", () => {
    expect(clampScroll(0, 3, 2)).toBe(2); // offset must shift so row 3 is at bottom
    expect(clampScroll(0, 5, 3)).toBe(3);
  });

  it("scrolls up to reveal rowIndex when it is above the top of viewport", () => {
    expect(clampScroll(3, 1, 2)).toBe(1); // offset jumps up to row 1
    expect(clampScroll(5, 2, 3)).toBe(2);
  });

  it("clamps to 0 when rowIndex is 0", () => {
    expect(clampScroll(0, 0, 5)).toBe(0);
  });
});
