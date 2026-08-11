import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProgressEntry } from "../domain/types.js";
import { legacyProgressFilePath, progressDir, roadmapDir } from "./paths.js";
import { appendProgress, migrateLegacyProgress, readProgress } from "./progressStore.js";

describe("progressStore", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-test-"));
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

  it("reads a missing store as an empty array", () => {
    expect(readProgress(cwd)).toEqual([]);
  });

  it("round-trips a single appended entry", () => {
    appendProgress(cwd, sample);
    expect(readProgress(cwd)).toEqual([sample]);
  });

  it("accumulates multiple appends under a per-issue directory", () => {
    const second: ProgressEntry = {
      ...sample,
      type: "verified",
      message: "confirmed fix",
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    appendProgress(cwd, sample);
    appendProgress(cwd, second);
    expect(fs.readdirSync(path.join(progressDir(cwd), "1"))).toHaveLength(2);
    expect(readProgress(cwd)).toEqual([sample, second]);
  });

  it("keeps entries for different issues in different directories", () => {
    appendProgress(cwd, sample);
    appendProgress(cwd, { ...sample, issueId: 2 });
    expect(fs.readdirSync(progressDir(cwd)).sort()).toEqual(["1", "2"]);
  });

  // Two branches logging at the same instant must not collide on a filename, or the merge
  // conflicts for no reason. Identical entries are kept as two entries, never deduped.
  it("keeps two identical entries as two distinct files", () => {
    appendProgress(cwd, sample);
    appendProgress(cwd, sample);
    expect(fs.readdirSync(path.join(progressDir(cwd), "1"))).toHaveLength(2);
    expect(readProgress(cwd)).toEqual([sample, sample]);
  });

  it("returns entries in chronological order", () => {
    const later: ProgressEntry = { ...sample, createdAt: "2026-03-01T00:00:00.000Z" };
    const earlier: ProgressEntry = { ...sample, createdAt: "2026-02-01T00:00:00.000Z" };
    appendProgress(cwd, later);
    appendProgress(cwd, earlier);
    expect(readProgress(cwd).map((entry) => entry.createdAt)).toEqual([
      earlier.createdAt,
      later.createdAt,
    ]);
  });

  it("writes pretty-printed JSON with a trailing newline", () => {
    appendProgress(cwd, sample);
    const dir = path.join(progressDir(cwd), "1");
    const raw = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(sample);
  });

  it("throws a useful error naming the offending file", () => {
    const dir = path.join(progressDir(cwd), "1");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "bad.json"), "not json\n");
    expect(() => readProgress(cwd)).toThrow(/progress\/1\/bad\.json/);
  });

  describe("migration from the pre-directory layout", () => {
    const second: ProgressEntry = { ...sample, type: "verified", message: "confirmed fix" };

    function seedLegacy(entries: ProgressEntry[]): void {
      fs.writeFileSync(
        legacyProgressFilePath(cwd),
        `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      );
    }

    it("reads the legacy JSONL file when no progress directory exists", () => {
      seedLegacy([sample, second]);
      expect(readProgress(cwd)).toEqual([sample, second]);
    });

    it("reports the offending line number for a malformed legacy file", () => {
      seedLegacy([]);
      fs.writeFileSync(legacyProgressFilePath(cwd), "not json\n");
      expect(() => readProgress(cwd)).toThrow(/line 1/);
    });

    it("migrates the whole log on first append, losing nothing", () => {
      seedLegacy([sample, second]);
      const third: ProgressEntry = { ...sample, message: "third", createdAt: "2026-06-01T00:00:00.000Z" };

      appendProgress(cwd, third);

      expect(fs.existsSync(legacyProgressFilePath(cwd))).toBe(false);
      expect(readProgress(cwd)).toHaveLength(3);
      expect(readProgress(cwd)).toContainEqual(sample);
      expect(readProgress(cwd)).toContainEqual(second);
      expect(readProgress(cwd)).toContainEqual(third);
    });

    it("treats the legacy file as authoritative until it is deleted", () => {
      seedLegacy([sample, second]);
      // A half-written migration: directory exists with only part of the log.
      const dir = path.join(progressDir(cwd), "1");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "partial.json"), `${JSON.stringify(sample, null, 2)}\n`);

      expect(readProgress(cwd)).toEqual([sample, second]);
    });

    // Migrated entries are named by their position in the legacy file, not randomly, so a
    // re-run after an interrupted migration overwrites rather than duplicating the log.
    it("does not duplicate entries when re-run after an interrupted migration", () => {
      seedLegacy([sample, second]);
      const dir = path.join(progressDir(cwd), "1");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${sample.createdAt.replace(/[:.]/g, "-")}-0000.json`),
        `${JSON.stringify(sample, null, 2)}\n`,
      );

      migrateLegacyProgress(cwd);

      expect(readProgress(cwd)).toHaveLength(2);
      expect(readProgress(cwd)).toEqual([sample, second]);
    });

    it("is a no-op once the legacy file is gone", () => {
      appendProgress(cwd, sample);
      const before = fs.readdirSync(path.join(progressDir(cwd), "1"));
      migrateLegacyProgress(cwd);
      expect(fs.readdirSync(path.join(progressDir(cwd), "1"))).toEqual(before);
    });
  });
});
