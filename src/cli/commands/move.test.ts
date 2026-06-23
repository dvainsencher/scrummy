import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "../../storage/issuesStore.js";
import { addIssue } from "./addIssue.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { move, moveToBacklog } from "./move.js";

describe("move", () => {
  let cwd: string;
  let id: number;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    createSprint(cwd, "foundation", { goal: "g" });
    id = addIssue(cwd, "Dark mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("assigns the issue to an existing sprint", () => {
    move(cwd, id, "foundation");
    expect(readIssues(cwd)[0].sprint).toBe("foundation");
  });

  it("returns a confirmation message", () => {
    expect(move(cwd, id, "foundation")).toBe(`Moved issue #${id} to sprint "foundation"`);
  });

  it("returns a confirmation message for moveToBacklog", () => {
    move(cwd, id, "foundation");
    expect(moveToBacklog(cwd, id)).toBe(`Moved issue #${id} to backlog`);
  });

  it("rejects a sprint that does not exist", () => {
    expect(() => move(cwd, id, "missing")).toThrow(/missing/);
  });

  it("throws for a nonexistent issue", () => {
    expect(() => move(cwd, 999, "foundation")).toThrow(/999/);
  });

  it("moveToBacklog sets sprint back to empty", () => {
    move(cwd, id, "foundation");
    moveToBacklog(cwd, id);
    expect(readIssues(cwd)[0].sprint).toBe("");
  });
});
