import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addIssue } from "../cli/commands/addIssue.js";
import { createSprint } from "../cli/commands/createSprint.js";
import { init } from "../cli/commands/init.js";
import { logProgress } from "../cli/commands/logProgress.js";
import { move } from "../cli/commands/move.js";
import { setActive } from "../cli/commands/setActive.js";
import { setStatus } from "../cli/commands/setStatus.js";
import { setSprintStatus } from "../cli/commands/setSprintStatus.js";
import { spec } from "../cli/commands/spec.js";
import { buildPlan } from "./plan.js";

describe("buildPlan", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("puts issues with no sprint in the backlog, sorted by id", () => {
    addIssue(cwd, "Export to CSV");
    addIssue(cwd, "Dark mode");
    const plan = buildPlan(cwd, {});
    expect(plan.backlog.map((i) => i.title)).toEqual(["Export to CSV", "Dark mode"]);
  });

  it("derives hasSpec from whether the spec file exists", () => {
    const id = addIssue(cwd, "Dark mode");
    expect(buildPlan(cwd, {}).backlog[0].hasSpec).toBe(false);
    spec(cwd, id);
    expect(buildPlan(cwd, {}).backlog[0].hasSpec).toBe(true);
  });

  it("derives hasLog from whether any progress entries exist for the issue", () => {
    const id = addIssue(cwd, "Dark mode");
    expect(buildPlan(cwd, {}).backlog[0].hasLog).toBe(false);
    logProgress(cwd, id, "plan", "investigate root cause");
    expect(buildPlan(cwd, {}).backlog[0].hasLog).toBe(true);
  });

  it("groups issues under their sprint", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    const id = addIssue(cwd, "Dark mode", { sprint: "foundation" });
    addIssue(cwd, "CSV export");
    const plan = buildPlan(cwd, {});
    expect(plan.backlog).toHaveLength(1);
    expect(plan.sprints).toHaveLength(1);
    expect(plan.sprints[0].name).toBe("foundation");
    expect(plan.sprints[0].issues.map((i) => i.id)).toEqual([id]);
  });

  it("sorts sprints by position, active sprint first", () => {
    createSprint(cwd, "first", { goal: "g", position: 10 });
    createSprint(cwd, "second", { goal: "g", position: 20 });
    setActive(cwd, "second");
    const plan = buildPlan(cwd, {});
    expect(plan.sprints.map((s) => s.name)).toEqual(["second", "first"]);
    expect(plan.sprints[0].active).toBe(true);
    expect(plan.sprints[1].active).toBe(false);
  });

  it("hides done issues by default", () => {
    const id = addIssue(cwd, "Dark mode");
    setStatus(cwd, id, "done");
    expect(buildPlan(cwd, {}).backlog).toHaveLength(0);
  });

  it("shows done issues when done: true", () => {
    const id = addIssue(cwd, "Dark mode");
    setStatus(cwd, id, "done");
    expect(buildPlan(cwd, { done: true }).backlog).toHaveLength(1);
  });

  it("hides done sprints by default", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setSprintStatus(cwd, "foundation", "done");
    expect(buildPlan(cwd, {}).sprints).toHaveLength(0);
  });

  it("shows done sprints when done: true", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setSprintStatus(cwd, "foundation", "done");
    expect(buildPlan(cwd, { done: true }).sprints).toHaveLength(1);
  });

  it("filters to a single sprint and omits the backlog", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    createSprint(cwd, "the-reader", { goal: "g2" });
    addIssue(cwd, "backlog issue");
    move(cwd, addIssue(cwd, "in sprint"), "foundation");
    const plan = buildPlan(cwd, { sprint: "foundation" });
    expect(plan.backlog).toEqual([]);
    expect(plan.sprints.map((s) => s.name)).toEqual(["foundation"]);
    expect(plan.filteredBySprint).toBe("foundation");
  });

  it("does not set filteredBySprint for an unfiltered plan", () => {
    expect(buildPlan(cwd, {}).filteredBySprint).toBeUndefined();
  });

  it("an explicit --sprint filter on a done sprint still shows it", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setSprintStatus(cwd, "foundation", "done");
    const plan = buildPlan(cwd, { sprint: "foundation" });
    expect(plan.sprints.map((s) => s.name)).toEqual(["foundation"]);
  });

  it("throws for a nonexistent --sprint filter", () => {
    expect(() => buildPlan(cwd, { sprint: "missing" })).toThrow(/missing/);
  });
});
