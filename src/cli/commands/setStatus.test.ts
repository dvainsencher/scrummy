import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "../../storage/issuesStore.js";
import { addIssue } from "./addIssue.js";
import { init } from "./init.js";
import { setStatus } from "./setStatus.js";

describe("setStatus", () => {
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

  it("sets the status", () => {
    setStatus(cwd, id, "doing");
    expect(readIssues(cwd)[0].status).toBe("doing");
  });

  it("returns a confirmation message", () => {
    expect(setStatus(cwd, id, "doing")).toBe(`Set issue #${id} status to "doing"`);
  });

  it("allows jumping straight to done, unenforced transitions", () => {
    setStatus(cwd, id, "done");
    expect(readIssues(cwd)[0].status).toBe("done");
  });

  it("throws for a nonexistent id", () => {
    expect(() => setStatus(cwd, 999, "done")).toThrow(/999/);
  });

  it("rejects an invalid status", () => {
    expect(() => setStatus(cwd, id, "bogus")).toThrow(/bogus/);
  });
});
