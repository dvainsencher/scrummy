import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Item } from "../domain/types.js";
import { itemsFilePath, roadmapDir } from "./paths.js";
import { readItems, writeItems } from "./itemsStore.js";

describe("itemsStore", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const sample: Item = {
    id: 1,
    title: "First item",
    status: "idea",
    sprint: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("reads an empty/missing file as an empty array", () => {
    expect(readItems(cwd)).toEqual([]);
  });

  it("round-trips items through write then read", () => {
    writeItems(cwd, [sample]);
    expect(readItems(cwd)).toEqual([sample]);
  });

  it("round-trips multiple items, one per line", () => {
    const second: Item = { ...sample, id: 2, title: "Second item" };
    writeItems(cwd, [sample, second]);
    const raw = fs.readFileSync(itemsFilePath(cwd), "utf8");
    expect(raw.split("\n").filter(Boolean)).toHaveLength(2);
    expect(readItems(cwd)).toEqual([sample, second]);
  });

  it("ends the file with a trailing newline", () => {
    writeItems(cwd, [sample]);
    const raw = fs.readFileSync(itemsFilePath(cwd), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("throws a useful error on a malformed line", () => {
    fs.writeFileSync(itemsFilePath(cwd), "not json\n");
    expect(() => readItems(cwd)).toThrow(/line 1/);
  });

  it("tolerates trailing blank lines", () => {
    fs.writeFileSync(itemsFilePath(cwd), `${JSON.stringify(sample)}\n\n`);
    expect(readItems(cwd)).toEqual([sample]);
  });
});
