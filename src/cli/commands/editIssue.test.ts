import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "../../storage/issuesStore.js";
import { addIssue } from "./addIssue.js";
import { editIssue } from "./editIssue.js";
import { init } from "./init.js";

describe("editIssue", () => {
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

  it("updates the title", () => {
    editIssue(cwd, id, { title: "Light mode" });
    expect(readIssues(cwd)[0].title).toBe("Light mode");
  });

  it("returns a confirmation message", () => {
    expect(editIssue(cwd, id, { title: "Light mode" })).toBe(`Updated issue #${id}`);
  });

  it("updates the status", () => {
    editIssue(cwd, id, { status: "doing" });
    expect(readIssues(cwd)[0].status).toBe("doing");
  });

  it("bumps updatedAt", () => {
    const before = readIssues(cwd)[0].updatedAt;
    editIssue(cwd, id, { title: "Light mode" });
    const after = readIssues(cwd)[0].updatedAt;
    expect(after >= before).toBe(true);
  });

  it("throws for a nonexistent id", () => {
    expect(() => editIssue(cwd, 999, { title: "x" })).toThrow(/999/);
  });

  it("rejects an invalid status", () => {
    expect(() => editIssue(cwd, id, { status: "bogus" })).toThrow(/bogus/);
  });
});
