import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSprints } from "../../storage/sprintsStore.js";
import { init } from "./init.js";
import { createSprint } from "./createSprint.js";

describe("createSprint", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("creates a sprint with status planned", () => {
    createSprint(cwd, "foundation", { goal: "build the mechanical layer" });
    const [sprint] = readSprints(cwd);
    expect(sprint).toMatchObject({
      name: "foundation",
      status: "planned",
      goal: "build the mechanical layer",
      notes: "",
    });
  });

  it("returns a confirmation message", () => {
    expect(createSprint(cwd, "foundation", { goal: "g1" })).toBe('Created sprint "foundation"');
  });

  it("defaults position to 10 past the highest existing position", () => {
    createSprint(cwd, "foundation", { goal: "g1" });
    createSprint(cwd, "the-reader", { goal: "g2" });
    const sprints = readSprints(cwd);
    expect(sprints[0].position).toBe(10);
    expect(sprints[1].position).toBe(20);
  });

  it("accepts an explicit position", () => {
    createSprint(cwd, "foundation", { goal: "g1", position: 5 });
    expect(readSprints(cwd)[0].position).toBe(5);
  });

  it("accepts notes", () => {
    createSprint(cwd, "foundation", { goal: "g1", notes: "n" });
    expect(readSprints(cwd)[0].notes).toBe("n");
  });

  it("rejects a duplicate sprint name", () => {
    createSprint(cwd, "foundation", { goal: "g1" });
    expect(() => createSprint(cwd, "foundation", { goal: "g2" })).toThrow(/foundation/);
  });
});
