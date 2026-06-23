import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSprints } from "../../storage/sprintsStore.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { setActive } from "./setActive.js";

describe("setActive", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    createSprint(cwd, "foundation", { goal: "g1" });
    createSprint(cwd, "the-reader", { goal: "g2" });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("sets the named sprint's status to active", () => {
    setActive(cwd, "foundation");
    const foundation = readSprints(cwd).find((s) => s.name === "foundation");
    expect(foundation?.status).toBe("active");
  });

  it("returns a confirmation message", () => {
    expect(setActive(cwd, "foundation")).toBe('Activated sprint "foundation"');
  });

  it("demotes a previously active sprint back to planned", () => {
    setActive(cwd, "foundation");
    setActive(cwd, "the-reader");
    const sprints = readSprints(cwd);
    expect(sprints.find((s) => s.name === "foundation")?.status).toBe("planned");
    expect(sprints.find((s) => s.name === "the-reader")?.status).toBe("active");
  });

  it("leaves a done sprint as done if it wasn't active", () => {
    setActive(cwd, "foundation");
    setActive(cwd, "foundation");
    expect(readSprints(cwd).filter((s) => s.status === "active")).toHaveLength(1);
  });

  it("throws for a nonexistent sprint", () => {
    expect(() => setActive(cwd, "missing")).toThrow(/missing/);
  });
});
