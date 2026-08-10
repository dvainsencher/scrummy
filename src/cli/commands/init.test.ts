import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issuesDir, specsDir, sprintsDir } from "../../storage/paths.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints } from "../../storage/sprintsStore.js";
import { init } from "./init.js";

describe("init", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-test-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("creates an empty issues store", () => {
    init(cwd);
    expect(fs.statSync(issuesDir(cwd)).isDirectory()).toBe(true);
    expect(readIssues(cwd)).toEqual([]);
  });

  it("returns a confirmation message", () => {
    expect(init(cwd)).toBe("Initialized docs/roadmap/");
  });

  it("creates an empty sprints store", () => {
    init(cwd);
    expect(fs.statSync(sprintsDir(cwd)).isDirectory()).toBe(true);
    expect(readSprints(cwd)).toEqual([]);
  });

  it("creates the specs directory", () => {
    init(cwd);
    expect(fs.statSync(specsDir(cwd)).isDirectory()).toBe(true);
  });

  it("is idempotent — running twice does not error or wipe existing data", () => {
    init(cwd);
    writeIssues(cwd, [
      {
        id: 1,
        title: "kept",
        status: "idea",
        sprint: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    init(cwd);
    expect(readIssues(cwd).map((issue) => issue.title)).toEqual(["kept"]);
  });

  it("refuses to init when docs/roadmap/ already exists with non-scrummy content", () => {
    fs.mkdirSync(path.join(cwd, "docs", "roadmap"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "docs", "roadmap", "ROADMAP.md"), "# legacy backlog\n");
    expect(() => init(cwd)).toThrow(/docs\/roadmap-legacy/);
    expect(fs.existsSync(issuesDir(cwd))).toBe(false);
  });

  it("accepts a project still on the pre-directory layout", () => {
    const roadmap = path.join(cwd, "docs", "roadmap");
    fs.mkdirSync(roadmap, { recursive: true });
    fs.writeFileSync(path.join(roadmap, "issues.jsonl"), "");
    fs.writeFileSync(path.join(roadmap, "sprints.json"), "[]\n");
    expect(() => init(cwd)).not.toThrow();
  });

  it("recovers from an init interrupted after specsDir was created but before the stores were written", () => {
    fs.mkdirSync(specsDir(cwd), { recursive: true });
    expect(() => init(cwd)).not.toThrow();
    expect(fs.existsSync(issuesDir(cwd))).toBe(true);
    expect(readIssues(cwd)).toEqual([]);
  });
});
