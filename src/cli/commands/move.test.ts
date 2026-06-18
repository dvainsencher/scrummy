import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readItems } from "../../storage/itemsStore.js";
import { addItem } from "./addItem.js";
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
    id = addItem(cwd, "Dark mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("assigns the item to an existing sprint", () => {
    move(cwd, id, "foundation");
    expect(readItems(cwd)[0].sprint).toBe("foundation");
  });

  it("rejects a sprint that does not exist", () => {
    expect(() => move(cwd, id, "missing")).toThrow(/missing/);
  });

  it("throws for a nonexistent item", () => {
    expect(() => move(cwd, 999, "foundation")).toThrow(/999/);
  });

  it("moveToBacklog sets sprint back to empty", () => {
    move(cwd, id, "foundation");
    moveToBacklog(cwd, id);
    expect(readItems(cwd)[0].sprint).toBe("");
  });
});
