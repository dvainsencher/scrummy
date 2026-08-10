import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Issue, ProgressEntry, Sprint } from "../domain/types.js";
import { main } from "../bin/scrummy.js";
import { readIssues } from "./issuesStore.js";
import { readProgress } from "./progressStore.js";
import { readSprints } from "./sprintsStore.js";
import { migrateRoadmapLayout } from "./migrate.js";
import {
  issuesDir,
  legacyIssuesFilePath,
  legacyProgressFilePath,
  legacySprintsFilePath,
  progressDir,
  roadmapDir,
  sprintsDir,
} from "./paths.js";

describe("migrateRoadmapLayout", () => {
  let cwd: string;

  const issue: Issue = {
    id: 1,
    title: "an issue",
    status: "idea",
    sprint: "foundation",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const sprint: Sprint = { name: "foundation", position: 10, goal: "g", notes: "" };
  const entry: ProgressEntry = {
    issueId: 1,
    type: "plan",
    message: "a note",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  function seedLegacyProject(): void {
    fs.mkdirSync(roadmapDir(cwd), { recursive: true });
    fs.writeFileSync(legacyIssuesFilePath(cwd), `${JSON.stringify(issue)}\n`);
    fs.writeFileSync(legacySprintsFilePath(cwd), `${JSON.stringify([sprint], null, 2)}\n`);
    fs.writeFileSync(legacyProgressFilePath(cwd), `${JSON.stringify(entry)}\n`);
  }

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-migrate-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("does nothing when the project has no roadmap at all", () => {
    expect(() => migrateRoadmapLayout(cwd)).not.toThrow();
    expect(fs.existsSync(roadmapDir(cwd))).toBe(false);
  });

  it("converts every store in one pass and removes the legacy files", () => {
    seedLegacyProject();

    migrateRoadmapLayout(cwd);

    expect(fs.existsSync(legacyIssuesFilePath(cwd))).toBe(false);
    expect(fs.existsSync(legacySprintsFilePath(cwd))).toBe(false);
    expect(fs.existsSync(legacyProgressFilePath(cwd))).toBe(false);
    expect(fs.readdirSync(issuesDir(cwd))).toEqual(["1.json"]);
    expect(fs.readdirSync(sprintsDir(cwd))).toEqual(["foundation.json"]);
    expect(fs.readdirSync(progressDir(cwd))).toEqual(["1"]);
  });

  it("loses nothing", () => {
    seedLegacyProject();

    migrateRoadmapLayout(cwd);

    expect(readIssues(cwd)).toEqual([issue]);
    expect(readSprints(cwd)).toEqual([sprint]);
    expect(readProgress(cwd)).toEqual([entry]);
  });

  it("is idempotent", () => {
    seedLegacyProject();
    migrateRoadmapLayout(cwd);
    const snapshot = fs.readdirSync(issuesDir(cwd));

    expect(() => migrateRoadmapLayout(cwd)).not.toThrow();
    expect(fs.readdirSync(issuesDir(cwd))).toEqual(snapshot);
    expect(readIssues(cwd)).toEqual([issue]);
  });

  // The flaw this function exists to fix: relying on each store to migrate itself meant
  // `add-issue` converted issues.jsonl and left sprints.json and progress.jsonl behind,
  // so a project sat half-converted until something happened to write each other store.
  it("converts every store even when the command only touches one of them", () => {
    seedLegacyProject();

    const code = main({ argv: ["add-issue", "new"], cwd, stdout: () => {}, stderr: () => {} });

    expect(code).toBe(0);
    expect(fs.existsSync(legacySprintsFilePath(cwd))).toBe(false);
    expect(fs.existsSync(legacyProgressFilePath(cwd))).toBe(false);
    expect(readSprints(cwd)).toEqual([sprint]);
    expect(readProgress(cwd)).toEqual([entry]);
    expect(readIssues(cwd).map((i) => i.title)).toEqual(["an issue", "new"]);
  });

  it("leaves an already-converted project untouched", () => {
    main({ argv: ["init"], cwd, stdout: () => {}, stderr: () => {} });
    main({ argv: ["add-issue", "only"], cwd, stdout: () => {}, stderr: () => {} });
    const before = fs.readFileSync(path.join(issuesDir(cwd), "1.json"), "utf8");

    migrateRoadmapLayout(cwd);

    expect(fs.readFileSync(path.join(issuesDir(cwd), "1.json"), "utf8")).toBe(before);
  });
});
