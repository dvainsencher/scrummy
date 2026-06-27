import { describe, expect, it, beforeAll, beforeEach, afterEach } from "vitest";
import { render } from "ink-testing-library";
import { act } from "react";
import React from "react";

// Required for act() to work in a non-DOM test environment (ink uses react-reconciler)
beforeAll(() => { (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; });
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KanbanApp, clampScroll, computeLayout, buildViewData } from "./view.js";
import { init } from "./init.js";
import { addIssue } from "./addIssue.js";
import { setStatus } from "./setStatus.js";
import type { KanbanData } from "./kanban.js";

function makeData(overrides: Partial<KanbanData> = {}): KanbanData {
  return {
    sprintName: null,
    columns: { idea: [], ready: [], doing: [], done: [] },
    allSprints: [],
    ...overrides,
  };
}

// Height (in rows) of the first issue card in the left column: span from its top border
// (┌ or ╔ when selected) to the next bottom border (└ or ╚). tops[0] is the column header
// box; tops[1] is the first card. The enforced footprint is CARD_HEIGHT-1 bordered rows.
function firstCardHeight(frame: string): number {
  const lines = frame.split("\n");
  const isTop = (l: string) => /^[┌╔]/.test(l.trimStart());
  const isBottom = (l: string) => /^[└╚]/.test(l.trimStart());
  const tops = lines.flatMap((l, i) => (isTop(l) ? [i] : []));
  const cardTop = tops[1];
  const cardBottom = lines.findIndex((l, i) => i > cardTop && isBottom(l));
  return cardBottom - cardTop + 1;
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

  it("truncates a long title to one line so card height stays fixed (structural CARD_HEIGHT invariant)", () => {
    // A title longer than the card width must be truncated (wrap="truncate-end"), never wrapped —
    // otherwise the card grows past CARD_HEIGHT and maxVisible overestimates (#66 root cause).
    const longTitle = "X".repeat(200);
    const issue = {
      id: 1, title: longTitle, status: "idea" as const,
      sprint: "", createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    };
    const data = makeData({ columns: { idea: [issue], ready: [], doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} maxVisibleCards={3} />);
    const frame = lastFrame() ?? "";
    // The full 200-char title cannot appear: it was truncated to the card width on a single line.
    expect(frame).not.toContain(longTitle);
    expect(frame).toContain("X"); // but the (truncated) title is rendered
    expect(firstCardHeight(frame)).toBe(6); // CARD_HEIGHT-1 bordered rows — unchanged by title length
  });

  it("truncates a long sprint name to one line (every variable row must be single-line, not just the title)", () => {
    // Regression: a long sprint name wrapped to 2 lines, overflowing the enforced card
    // height and clipping the #id/status row. The sprint row must truncate like the title.
    const longSprint = "Consignacao v2 — reporting & automation and a very long suffix".repeat(3);
    const issue = {
      id: 1, title: "Short", status: "idea" as const,
      sprint: longSprint, createdAt: "", updatedAt: "", hasSpec: false, hasLog: false,
    };
    const data = makeData({ sprintName: longSprint, columns: { idea: [issue], ready: [], doing: [], done: [] } });
    const { lastFrame } = render(<KanbanApp data={data} maxVisibleCards={3} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("#1");   // id/status row not clipped out by an over-tall card
    expect(frame).toContain("[idea]");
    expect(firstCardHeight(frame)).toBe(6); // CARD_HEIGHT-1 bordered rows — unchanged by sprint length
  });
});

describe("computeLayout", () => {
  it("derives maxVisible from terminal height (exact because CARD_HEIGHT is enforced)", () => {
    // (rows - FIXED_ROWS(7) - 2) / CARD_HEIGHT(7)
    expect(computeLayout(24, 120).maxVisible).toBe(2); // floor(15/7)
    expect(computeLayout(40, 120).maxVisible).toBe(4); // floor(31/7)
    expect(computeLayout(10, 120).maxVisible).toBe(1); // raw floor((10-9)/7)=0, clamped up to 1
  });

  it("fills terminal width across four columns on a wide terminal", () => {
    const { columnWidth, cardWidth } = computeLayout(40, 120);
    expect(columnWidth).toBe(29); // floor(120/4) - COLUMN_GAP(1)
    expect(cardWidth).toBe(27);   // columnWidth - 2 (border)
  });

  it("clamps to MIN_COL_WIDTH on a narrow terminal", () => {
    const { columnWidth, cardWidth } = computeLayout(40, 40);
    expect(columnWidth).toBe(16); // max(MIN_COL_WIDTH=16, floor(40/4)-1=9)
    expect(cardWidth).toBe(14);
  });
});

describe("buildViewData", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-view-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("includes done-column issues (view() must pass { done: true } to buildPlan)", () => {
    // All KanbanApp tests inject mock data and bypass buildPlan, so dropping { done: true }
    // from view() would go undetected. This drives the real buildPlan+buildKanbanData boundary.
    const id = addIssue(cwd, "Shipped feature");
    setStatus(cwd, id, "done");
    const { data } = buildViewData(cwd);
    expect(data.columns.done.map((i) => i.id)).toContain(id);
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
