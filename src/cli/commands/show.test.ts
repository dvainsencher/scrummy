import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addIssue } from "./addIssue.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { move } from "./move.js";
import { show } from "./show.js";

describe("show", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("renders pretty by default", () => {
    addIssue(cwd, "Dark mode");
    const out = show(cwd, {});
    expect(out).toContain("BACKLOG (1)");
    expect(out).toContain("Dark mode");
  });

  it("renders json when json: true", () => {
    addIssue(cwd, "Dark mode");
    const out = show(cwd, { json: true });
    const parsed = JSON.parse(out);
    expect(parsed.backlog[0].title).toBe("Dark mode");
  });

  it("passes through sprint and done options", () => {
    addIssue(cwd, "Dark mode");
    expect(() => show(cwd, { sprint: "missing" })).toThrow(/missing/);
  });

  describe("show with id", () => {
    it("returns just the matching issue in pretty format", () => {
      addIssue(cwd, "First issue");
      const id = addIssue(cwd, "Target issue");
      addIssue(cwd, "Third issue");
      const out = show(cwd, { id });
      expect(out).toContain("Target issue");
      expect(out).not.toContain("First issue");
      expect(out).not.toContain("Third issue");
    });

    it("shows 'backlog' for an issue not in any sprint", () => {
      const issueId = addIssue(cwd, "Backlog issue");
      const out = show(cwd, { id: issueId });
      expect(out).toContain("backlog");
    });

    it("shows the sprint name for an issue assigned to a sprint", () => {
      createSprint(cwd, "my-sprint", { goal: "test" });
      const issueId = addIssue(cwd, "Sprint issue");
      move(cwd, issueId, "my-sprint");
      const out = show(cwd, { id: issueId });
      expect(out).toContain("sprint: my-sprint");
    });

    it("returns just the issue as JSON when json: true", () => {
      const id = addIssue(cwd, "JSON target");
      const out = show(cwd, { id, json: true });
      const parsed = JSON.parse(out);
      expect(parsed.title).toBe("JSON target");
      expect(parsed.id).toBe(id);
    });

    it("throws when the issue does not exist", () => {
      expect(() => show(cwd, { id: 999 })).toThrow(/999/);
    });
  });
});
