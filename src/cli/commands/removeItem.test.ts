import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specFilePath, specsDir } from "../../storage/paths.js";
import { readItems } from "../../storage/itemsStore.js";
import { addItem } from "./addItem.js";
import { init } from "./init.js";
import { removeItem } from "./removeItem.js";

describe("removeItem", () => {
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

  it("removes the item", () => {
    removeItem(cwd, id);
    expect(readItems(cwd)).toEqual([]);
  });

  it("deletes the spec file if one exists", () => {
    fs.mkdirSync(specsDir(cwd), { recursive: true });
    fs.writeFileSync(specFilePath(cwd, id), "# Dark mode\n");
    removeItem(cwd, id);
    expect(fs.existsSync(specFilePath(cwd, id))).toBe(false);
  });

  it("does not error if there is no spec file", () => {
    expect(() => removeItem(cwd, id)).not.toThrow();
  });

  it("throws for a nonexistent id", () => {
    expect(() => removeItem(cwd, 999)).toThrow(/999/);
  });
});
