import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSprints } from "../../storage/sprintsStore.js";
import { createSprint } from "./createSprint.js";
import { editSprint } from "./editSprint.js";
import { init } from "./init.js";

describe("editSprint", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    createSprint(cwd, "foundation", { goal: "old goal" });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("updates the goal", () => {
    editSprint(cwd, "foundation", { goal: "new goal" });
    expect(readSprints(cwd)[0].goal).toBe("new goal");
  });

  it("updates notes", () => {
    editSprint(cwd, "foundation", { notes: "new notes" });
    expect(readSprints(cwd)[0].notes).toBe("new notes");
  });

  it("leaves untouched fields alone", () => {
    editSprint(cwd, "foundation", { notes: "n" });
    expect(readSprints(cwd)[0].goal).toBe("old goal");
  });

  it("throws for a nonexistent sprint", () => {
    expect(() => editSprint(cwd, "missing", { goal: "g" })).toThrow(/missing/);
  });
});
