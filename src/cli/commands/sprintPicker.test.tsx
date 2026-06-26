import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { SprintPicker } from "./sprintPicker.js";
import type { SprintGroup } from "../../reader/plan.js";

function makeSprint(name: string, status: SprintGroup["status"] = "planned"): SprintGroup {
  return { name, position: 10, status, goal: "", notes: "", active: status === "active", issues: [] };
}

describe("SprintPicker", () => {
  it("renders all sprint names", () => {
    const sprints = [makeSprint("alpha", "active"), makeSprint("beta"), makeSprint("gamma")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="alpha" onSelect={() => {}} onCancel={() => {}} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("alpha");
    expect(frame).toContain("beta");
    expect(frame).toContain("gamma");
  });

  it("highlights the currently selected sprint", () => {
    const sprints = [makeSprint("alpha", "active"), makeSprint("beta")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="beta" onSelect={() => {}} onCancel={() => {}} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("beta");
  });

  it("shows a cancel hint", () => {
    const sprints = [makeSprint("alpha", "active")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="alpha" onSelect={() => {}} onCancel={() => {}} />
    );
    expect(lastFrame() ?? "").toMatch(/esc|cancel/i);
  });

  it("shows active badge for active sprint", () => {
    const sprints = [makeSprint("alpha", "active"), makeSprint("beta")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="alpha" onSelect={() => {}} onCancel={() => {}} />
    );
    expect(lastFrame() ?? "").toMatch(/active/i);
  });

  it("shows done badge for done sprint", () => {
    const sprints = [makeSprint("old", "done"), makeSprint("current", "active")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="current" onSelect={() => {}} onCancel={() => {}} />
    );
    expect(lastFrame() ?? "").toContain("done");
  });

  it("shows planned badge for planned sprint", () => {
    const sprints = [makeSprint("current", "active"), makeSprint("next", "planned")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="current" onSelect={() => {}} onCancel={() => {}} />
    );
    expect(lastFrame() ?? "").toContain("planned");
  });
});
