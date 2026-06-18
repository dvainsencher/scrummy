import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sprint } from "../domain/types.js";
import { roadmapDir, sprintsFilePath } from "./paths.js";
import { readSprints, writeSprints } from "./sprintsStore.js";

describe("sprintsStore", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const sample: Sprint = {
    name: "foundation",
    position: 10,
    status: "planned",
    goal: "build the mechanical layer",
    notes: "",
  };

  it("reads a missing file as an empty array", () => {
    expect(readSprints(cwd)).toEqual([]);
  });

  it("round-trips sprints through write then read", () => {
    writeSprints(cwd, [sample]);
    expect(readSprints(cwd)).toEqual([sample]);
  });

  it("writes pretty-printed JSON", () => {
    writeSprints(cwd, [sample]);
    const raw = fs.readFileSync(sprintsFilePath(cwd), "utf8");
    expect(raw).toContain("\n");
    expect(JSON.parse(raw)).toEqual([sample]);
  });

  it("writes an empty array as []", () => {
    writeSprints(cwd, []);
    expect(readSprints(cwd)).toEqual([]);
  });
});
