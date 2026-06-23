import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readProgress } from "../../storage/progressStore.js";
import { addIssue } from "./addIssue.js";
import { init } from "./init.js";
import { logProgress } from "./logProgress.js";

describe("logProgress", () => {
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

  it("appends a progress entry for an existing issue", () => {
    logProgress(cwd, id, "plan", "investigate root cause");
    const entries = readProgress(cwd);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ issueId: id, type: "plan", message: "investigate root cause" });
    expect(entries[0].createdAt).toBeTruthy();
  });

  it("returns a confirmation message", () => {
    expect(logProgress(cwd, id, "plan", "investigate root cause")).toBe(
      `Logged plan entry for issue #${id}`,
    );
  });

  it("throws for a nonexistent issue", () => {
    expect(() => logProgress(cwd, 999, "plan", "x")).toThrow(/999/);
  });

  it("rejects an invalid progress type", () => {
    expect(() => logProgress(cwd, id, "bogus", "x")).toThrow(/bogus/);
  });
});
