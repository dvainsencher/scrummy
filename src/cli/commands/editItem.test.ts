import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readItems } from "../../storage/itemsStore.js";
import { addItem } from "./addItem.js";
import { editItem } from "./editItem.js";
import { init } from "./init.js";

describe("editItem", () => {
  let cwd: string;
  let id: number;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    id = addItem(cwd, "Dark mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("updates the title", () => {
    editItem(cwd, id, { title: "Light mode" });
    expect(readItems(cwd)[0].title).toBe("Light mode");
  });

  it("updates the status", () => {
    editItem(cwd, id, { status: "doing" });
    expect(readItems(cwd)[0].status).toBe("doing");
  });

  it("bumps updatedAt", () => {
    const before = readItems(cwd)[0].updatedAt;
    editItem(cwd, id, { title: "Light mode" });
    const after = readItems(cwd)[0].updatedAt;
    expect(after >= before).toBe(true);
  });

  it("throws for a nonexistent id", () => {
    expect(() => editItem(cwd, 999, { title: "x" })).toThrow(/999/);
  });

  it("rejects an invalid status", () => {
    expect(() => editItem(cwd, id, { status: "bogus" })).toThrow(/bogus/);
  });
});
