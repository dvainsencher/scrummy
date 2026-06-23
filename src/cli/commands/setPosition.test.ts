import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSprints } from "../../storage/sprintsStore.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { setPosition } from "./setPosition.js";

describe("setPosition", () => {
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

  it("sets the position", () => {
    setPosition(cwd, "foundation", 5);
    expect(readSprints(cwd).find((s) => s.name === "foundation")?.position).toBe(5);
  });

  it("returns a confirmation message", () => {
    expect(setPosition(cwd, "foundation", 5)).toBe('Set sprint "foundation" position to 5');
  });

  it("does not renumber other sprints", () => {
    setPosition(cwd, "foundation", 5);
    expect(readSprints(cwd).find((s) => s.name === "the-reader")?.position).toBe(20);
  });

  it("throws for a nonexistent sprint", () => {
    expect(() => setPosition(cwd, "missing", 5)).toThrow(/missing/);
  });
});
