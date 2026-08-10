import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  issuesDir,
  legacyIssuesFilePath,
  legacyProgressFilePath,
  legacySprintsFilePath,
  progressDir,
  roadmapDir,
  specFilePath,
  specsDir,
  sprintsDir,
} from "./paths.js";

describe("paths", () => {
  const cwd = "/tmp/some-project";
  const roadmap = path.join(cwd, "docs", "roadmap");

  it("resolves the roadmap dir under docs/roadmap", () => {
    expect(roadmapDir(cwd)).toBe(roadmap);
  });

  it("resolves the issues dir inside the roadmap dir", () => {
    expect(issuesDir(cwd)).toBe(path.join(roadmap, "issues"));
  });

  it("resolves the sprints dir inside the roadmap dir", () => {
    expect(sprintsDir(cwd)).toBe(path.join(roadmap, "sprints"));
  });

  it("resolves the progress dir inside the roadmap dir", () => {
    expect(progressDir(cwd)).toBe(path.join(roadmap, "progress"));
  });

  it("resolves specs dir inside the roadmap dir", () => {
    expect(specsDir(cwd)).toBe(path.join(roadmap, "specs"));
  });

  it("resolves a spec file path by issue id", () => {
    expect(specFilePath(cwd, 12)).toBe(path.join(roadmap, "specs", "12.md"));
  });

  it("still resolves the pre-directory files, which are read until migration", () => {
    expect(legacyIssuesFilePath(cwd)).toBe(path.join(roadmap, "issues.jsonl"));
    expect(legacySprintsFilePath(cwd)).toBe(path.join(roadmap, "sprints.json"));
    expect(legacyProgressFilePath(cwd)).toBe(path.join(roadmap, "progress.jsonl"));
  });
});
