import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSprints } from "../../storage/sprintsStore.js";
import { addIssue } from "./addIssue.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { removeSprint } from "./removeSprint.js";

describe("removeSprint", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    createSprint(cwd, "foundation", { goal: "build the basics" });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("removes an empty sprint", () => {
    removeSprint(cwd, "foundation");
    expect(readSprints(cwd)).toEqual([]);
  });

  it("returns a confirmation message", () => {
    createSprint(cwd, "other", { goal: "g" });
    expect(removeSprint(cwd, "other")).toBe('Removed sprint "other"');
  });

  it("throws for a nonexistent sprint", () => {
    expect(() => removeSprint(cwd, "missing")).toThrow(/missing/);
  });

  it("throws if the sprint still has issues assigned", () => {
    addIssue(cwd, "Dark mode", { sprint: "foundation" });
    expect(() => removeSprint(cwd, "foundation")).toThrow(/foundation/);
    expect(readSprints(cwd)).toHaveLength(1);
  });
});
