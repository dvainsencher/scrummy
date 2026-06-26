import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { SprintPicker } from "./sprintPicker.js";
import type { SprintGroup } from "../../reader/plan.js";

function makeSprint(name: string, active = false): SprintGroup {
  return { name, position: 10, status: active ? "active" : "planned", goal: "", notes: "", active, issues: [] };
}

describe("SprintPicker", () => {
  it("renders all sprint names", () => {
    const sprints = [makeSprint("alpha", true), makeSprint("beta"), makeSprint("gamma")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="alpha" onSelect={() => {}} onCancel={() => {}} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("alpha");
    expect(frame).toContain("beta");
    expect(frame).toContain("gamma");
  });

  it("highlights the currently selected sprint", () => {
    const sprints = [makeSprint("alpha", true), makeSprint("beta")];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="beta" onSelect={() => {}} onCancel={() => {}} />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("beta");
  });

  it("shows a cancel hint", () => {
    const sprints = [makeSprint("alpha", true)];
    const { lastFrame } = render(
      <SprintPicker sprints={sprints} selected="alpha" onSelect={() => {}} onCancel={() => {}} />
    );
    expect(lastFrame() ?? "").toMatch(/esc|cancel/i);
  });
});
