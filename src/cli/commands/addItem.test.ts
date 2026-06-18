import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readItems } from "../../storage/itemsStore.js";
import { addItem } from "./addItem.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";

describe("addItem", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("adds an item with default status idea and empty sprint, returns its id", () => {
    const id = addItem(cwd, "Dark mode");
    expect(id).toBe(1);
    const [item] = readItems(cwd);
    expect(item).toMatchObject({ id: 1, title: "Dark mode", status: "idea", sprint: "" });
  });

  it("accepts an explicit status", () => {
    addItem(cwd, "Dark mode", { status: "ready" });
    expect(readItems(cwd)[0].status).toBe("ready");
  });

  it("accepts a sprint that exists", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    addItem(cwd, "Dark mode", { sprint: "foundation" });
    expect(readItems(cwd)[0].sprint).toBe("foundation");
  });

  it("rejects a sprint that does not exist", () => {
    expect(() => addItem(cwd, "Dark mode", { sprint: "missing" })).toThrow(/missing/);
  });

  it("rejects an invalid status", () => {
    expect(() => addItem(cwd, "Dark mode", { status: "bogus" })).toThrow(/bogus/);
  });

  it("allocates increasing ids", () => {
    addItem(cwd, "first");
    const second = addItem(cwd, "second");
    expect(second).toBe(2);
  });
});
