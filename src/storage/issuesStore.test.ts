import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Issue } from "../domain/types.js";
import { issuesDir, legacyIssuesFilePath, roadmapDir } from "./paths.js";
import { readIssues, writeIssues } from "./issuesStore.js";

describe("issuesStore", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-test-"));
    fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const sample: Issue = {
    id: 1,
    title: "First issue",
    status: "idea",
    sprint: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("reads a missing store as an empty array", () => {
    expect(readIssues(cwd)).toEqual([]);
  });

  it("round-trips issues through write then read", () => {
    writeIssues(cwd, [sample]);
    expect(readIssues(cwd)).toEqual([sample]);
  });

  it("stores one file per issue, named by id", () => {
    const second: Issue = { ...sample, id: 2, title: "Second issue" };
    writeIssues(cwd, [sample, second]);
    expect(fs.readdirSync(issuesDir(cwd)).sort()).toEqual(["1.json", "2.json"]);
    expect(readIssues(cwd)).toEqual([sample, second]);
  });

  it("returns issues ordered by id regardless of directory order", () => {
    const ids = [10, 2, 33, 4];
    writeIssues(cwd, ids.map((id) => ({ ...sample, id })));
    expect(readIssues(cwd).map((issue) => issue.id)).toEqual([2, 4, 10, 33]);
  });

  it("writes pretty-printed JSON with a trailing newline", () => {
    writeIssues(cwd, [sample]);
    const raw = fs.readFileSync(path.join(issuesDir(cwd), "1.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  "title": "First issue"');
    expect(JSON.parse(raw)).toEqual(sample);
  });

  // Load-bearing, not an optimization: rewriting untouched records would put every issue
  // in every commit and reintroduce exactly the merge conflicts this layout removes.
  it("leaves untouched issues byte-identical when another issue changes", () => {
    const second: Issue = { ...sample, id: 2, title: "Second issue" };
    writeIssues(cwd, [sample, second]);
    const untouched = path.join(issuesDir(cwd), "1.json");
    const before = fs.statSync(untouched).mtimeMs;

    writeIssues(cwd, [sample, { ...second, status: "done" }]);

    expect(fs.statSync(untouched).mtimeMs).toBe(before);
    expect(readIssues(cwd)[1].status).toBe("done");
  });

  it("removes the file for an issue that is no longer present", () => {
    const second: Issue = { ...sample, id: 2 };
    writeIssues(cwd, [sample, second]);
    writeIssues(cwd, [sample]);
    expect(fs.readdirSync(issuesDir(cwd))).toEqual(["1.json"]);
    expect(readIssues(cwd)).toEqual([sample]);
  });

  it("throws a useful error naming the offending file", () => {
    fs.mkdirSync(issuesDir(cwd), { recursive: true });
    fs.writeFileSync(path.join(issuesDir(cwd), "7.json"), "not json\n");
    expect(() => readIssues(cwd)).toThrow(/issues\/7\.json/);
  });

  describe("migration from the pre-directory layout", () => {
    const second: Issue = { ...sample, id: 2, title: "Second issue" };

    function seedLegacy(issues: Issue[]): void {
      fs.writeFileSync(
        legacyIssuesFilePath(cwd),
        `${issues.map((issue) => JSON.stringify(issue)).join("\n")}\n`,
      );
    }

    it("reads the legacy JSONL file when no issues directory exists", () => {
      seedLegacy([sample, second]);
      expect(readIssues(cwd)).toEqual([sample, second]);
    });

    it("tolerates trailing blank lines in the legacy file", () => {
      fs.writeFileSync(legacyIssuesFilePath(cwd), `${JSON.stringify(sample)}\n\n`);
      expect(readIssues(cwd)).toEqual([sample]);
    });

    it("reports the offending line number for a malformed legacy file", () => {
      fs.writeFileSync(legacyIssuesFilePath(cwd), "not json\n");
      expect(() => readIssues(cwd)).toThrow(/line 1/);
    });

    it("migrates on first write, losing nothing and removing the legacy file", () => {
      seedLegacy([sample, second]);
      const third: Issue = { ...sample, id: 3, title: "Third issue" };

      writeIssues(cwd, [...readIssues(cwd), third]);

      expect(fs.existsSync(legacyIssuesFilePath(cwd))).toBe(false);
      expect(fs.readdirSync(issuesDir(cwd)).sort()).toEqual(["1.json", "2.json", "3.json"]);
      expect(readIssues(cwd)).toEqual([sample, second, third]);
    });

    it("prefers the directory once it exists, ignoring a leftover legacy file", () => {
      writeIssues(cwd, [sample]);
      seedLegacy([{ ...sample, id: 99, title: "stale" }]);
      expect(readIssues(cwd)).toEqual([sample]);
    });
  });
});
