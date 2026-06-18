import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { itemsFilePath, specsDir, sprintsFilePath } from "../../storage/paths.js";
import { readItems } from "../../storage/itemsStore.js";
import { readSprints } from "../../storage/sprintsStore.js";
import { init } from "./init.js";

describe("init", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("creates an empty items.jsonl", () => {
    init(cwd);
    expect(fs.existsSync(itemsFilePath(cwd))).toBe(true);
    expect(readItems(cwd)).toEqual([]);
  });

  it("creates an empty sprints.json ([])", () => {
    init(cwd);
    expect(fs.existsSync(sprintsFilePath(cwd))).toBe(true);
    expect(readSprints(cwd)).toEqual([]);
  });

  it("creates the specs directory", () => {
    init(cwd);
    expect(fs.statSync(specsDir(cwd)).isDirectory()).toBe(true);
  });

  it("is idempotent — running twice does not error or wipe existing data", () => {
    init(cwd);
    fs.writeFileSync(itemsFilePath(cwd), `${JSON.stringify({ id: 1 })}\n`);
    init(cwd);
    expect(fs.readFileSync(itemsFilePath(cwd), "utf8")).toContain('"id":1');
  });
});
