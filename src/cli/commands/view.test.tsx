import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { KanbanApp } from "./view.js";
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
});
