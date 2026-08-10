import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";
import { addIssue } from "./addIssue.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { validate } from "./validate.js";

describe("validate", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("reports OK for a clean backlog with no issues or sprints", () => {
    expect(validate(cwd)).toBe("OK: 0 issue(s), 0 sprint(s), no duplicates found");
  });

  it("reports OK when every id and sprint name written through the CLI is unique", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    addIssue(cwd, "Dark mode");
    addIssue(cwd, "Light mode");
    expect(validate(cwd)).toBe("OK: 2 issue(s), 1 sprint(s), no duplicates found");
  });

  // The CLI's own writers can never produce a duplicate id — this simulates the
  // out-of-band cases validate exists to catch: a bad merge conflict resolution,
  // or a manual edit to issues.jsonl (see CLAUDE.md's "CLI is the only writer" rule).
  it("throws when issues.jsonl has been left with a duplicate id", () => {
    const a = addIssue(cwd, "Dark mode");
    const issues = readIssues(cwd);
    writeIssues(cwd, [...issues, { ...issues[0], id: a, title: "Duplicate of #1" }]);

    expect(() => validate(cwd)).toThrow(new RegExp(`#${a}`));
  });

  it("throws when sprints.json has been left with a duplicate name", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    const sprints = readSprints(cwd);
    writeSprints(cwd, [...sprints, { ...sprints[0] }]);

    expect(() => validate(cwd)).toThrow(/foundation/);
  });
});
