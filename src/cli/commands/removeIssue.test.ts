import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specFilePath, specsDir } from "../../storage/paths.js";
import { readIssues } from "../../storage/issuesStore.js";
import { addIssue } from "./addIssue.js";
import { init } from "./init.js";
import { removeIssue } from "./removeIssue.js";

describe("removeIssue", () => {
  let cwd: string;
  let id: number;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    id = addIssue(cwd, "Dark mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("removes the issue", () => {
    removeIssue(cwd, id);
    expect(readIssues(cwd)).toEqual([]);
  });

  it("returns a confirmation message", () => {
    expect(removeIssue(cwd, id)).toBe(`Removed issue #${id}`);
  });

  it("deletes the spec file if one exists", () => {
    fs.mkdirSync(specsDir(cwd), { recursive: true });
    fs.writeFileSync(specFilePath(cwd, id), "# Dark mode\n");
    removeIssue(cwd, id);
    expect(fs.existsSync(specFilePath(cwd, id))).toBe(false);
  });

  it("does not error if there is no spec file", () => {
    expect(() => removeIssue(cwd, id)).not.toThrow();
  });

  it("throws for a nonexistent id", () => {
    expect(() => removeIssue(cwd, 999)).toThrow(/999/);
  });
});
