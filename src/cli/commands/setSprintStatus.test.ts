import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSprints } from "../../storage/sprintsStore.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { setSprintStatus } from "./setSprintStatus.js";

describe("setSprintStatus", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    createSprint(cwd, "foundation", { goal: "g" });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("sets the sprint status", () => {
    setSprintStatus(cwd, "foundation", "done");
    expect(readSprints(cwd)[0].status).toBe("done");
  });

  it("throws for a nonexistent sprint", () => {
    expect(() => setSprintStatus(cwd, "missing", "done")).toThrow(/missing/);
  });
});
