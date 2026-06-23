import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addIssue } from "./addIssue.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { setActive } from "./setActive.js";
import { setStatus } from "./setStatus.js";
import { status } from "./status.js";

describe("status", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("reports no active sprint when none is active", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    expect(status(cwd)).toBe("no active sprint");
  });

  it("shows the active sprint's done/total counts and the issue in progress", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setActive(cwd, "foundation");
    const first = addIssue(cwd, "Wire up CLI", { sprint: "foundation" });
    addIssue(cwd, "Write docs", { sprint: "foundation" });
    setStatus(cwd, first, "doing");

    expect(status(cwd)).toBe(`foundation 0/2 → #${first} Wire up CLI`);
  });

  it("falls back to the next not-done issue when nothing is in progress", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setActive(cwd, "foundation");
    const first = addIssue(cwd, "Wire up CLI", { sprint: "foundation" });
    addIssue(cwd, "Write docs", { sprint: "foundation" });

    expect(status(cwd)).toBe(`foundation 0/2 → #${first} Wire up CLI`);
  });

  it("counts done issues without pointing at them", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setActive(cwd, "foundation");
    const first = addIssue(cwd, "Wire up CLI", { sprint: "foundation" });
    setStatus(cwd, first, "done");

    expect(status(cwd)).toBe("foundation 1/1");
  });

  it("shows just the counts when the active sprint has no issues", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    setActive(cwd, "foundation");

    expect(status(cwd)).toBe("foundation 0/0");
  });
});
