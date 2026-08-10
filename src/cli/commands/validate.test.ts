import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";
import { issuesDir, sprintsDir } from "../../storage/paths.js";
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

  // The record's identity is now its filename, so the write path cannot express a
  // duplicate at all — two records with one id are one file.
  it("cannot be made to write a duplicate id through the store", () => {
    const a = addIssue(cwd, "Dark mode");
    const issues = readIssues(cwd);
    writeIssues(cwd, [...issues, { ...issues[0], id: a, title: "Duplicate of #1" }]);

    expect(readIssues(cwd)).toHaveLength(1);
    expect(validate(cwd)).toContain("no duplicates found");
  });

  it("cannot be made to write a duplicate sprint name through the store", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    const sprints = readSprints(cwd);
    writeSprints(cwd, [...sprints, { ...sprints[0] }]);

    expect(readSprints(cwd)).toHaveLength(1);
    expect(validate(cwd)).toContain("no duplicates found");
  });

  // What validate still exists for: state that arrived without going through the CLI.
  // A badly-resolved add/add merge is the realistic shape — both sides' files kept
  // under different names, carrying the same id (see CLAUDE.md's "CLI is the only
  // writer" rule, and storage/recordDir.ts on why add/add is the conflict that remains).
  it("throws when a bad merge has left two issue files sharing an id", () => {
    const a = addIssue(cwd, "Dark mode");
    const theirs = { ...readIssues(cwd)[0], title: "Duplicate of #1" };
    fs.writeFileSync(path.join(issuesDir(cwd), `${a}-theirs.json`), `${JSON.stringify(theirs, null, 2)}\n`);

    expect(() => validate(cwd)).toThrow(new RegExp(`#${a}`));
  });

  it("throws when a bad merge has left two sprint files sharing a name", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    const theirs = readSprints(cwd)[0];
    fs.writeFileSync(
      path.join(sprintsDir(cwd), "foundation-theirs.json"),
      `${JSON.stringify(theirs, null, 2)}\n`,
    );

    expect(() => validate(cwd)).toThrow(/foundation/);
  });
});
