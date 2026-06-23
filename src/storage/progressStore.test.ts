import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProgressEntry } from "../domain/types.js";
import { progressFilePath, roadmapDir } from "./paths.js";
import { appendProgress, readProgress } from "./progressStore.js";

describe("progressStore", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const sample: ProgressEntry = {
    issueId: 1,
    type: "plan",
    message: "investigate root cause",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("reads an empty/missing file as an empty array", () => {
    expect(readProgress(cwd)).toEqual([]);
  });

  it("round-trips a single appended entry", () => {
    appendProgress(cwd, sample);
    expect(readProgress(cwd)).toEqual([sample]);
  });

  it("accumulates multiple appends, one per line", () => {
    const second: ProgressEntry = { ...sample, type: "verified", message: "confirmed fix" };
    appendProgress(cwd, sample);
    appendProgress(cwd, second);
    const raw = fs.readFileSync(progressFilePath(cwd), "utf8");
    expect(raw.split("\n").filter(Boolean)).toHaveLength(2);
    expect(readProgress(cwd)).toEqual([sample, second]);
  });

  it("ends the file with a trailing newline", () => {
    appendProgress(cwd, sample);
    const raw = fs.readFileSync(progressFilePath(cwd), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("throws a useful error on a malformed line", () => {
    fs.writeFileSync(progressFilePath(cwd), "not json\n");
    expect(() => readProgress(cwd)).toThrow(/line 1/);
  });

  it("tolerates trailing blank lines", () => {
    fs.writeFileSync(progressFilePath(cwd), `${JSON.stringify(sample)}\n\n`);
    expect(readProgress(cwd)).toEqual([sample]);
  });
});
