import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addIssue } from "./addIssue.js";
import { init } from "./init.js";
import { logProgress } from "./logProgress.js";
import { showLog } from "./showLog.js";

describe("showLog", () => {
  let cwd: string;
  let id: number;
  let otherId: number;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    id = addIssue(cwd, "Dark mode");
    otherId = addIssue(cwd, "Light mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("returns only entries for the given issue, in order", () => {
    logProgress(cwd, id, "plan", "step one");
    logProgress(cwd, otherId, "plan", "unrelated");
    logProgress(cwd, id, "verified", "step one confirmed");

    const entries = showLog(cwd, id);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.message)).toEqual(["step one", "step one confirmed"]);
  });

  it("returns an empty array when the issue has no log entries", () => {
    expect(showLog(cwd, id)).toEqual([]);
  });

  it("throws for a nonexistent issue", () => {
    expect(() => showLog(cwd, 999)).toThrow(/999/);
  });
});
