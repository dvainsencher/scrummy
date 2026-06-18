import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  itemsFilePath,
  roadmapDir,
  specFilePath,
  specsDir,
  sprintsFilePath,
} from "./paths.js";

describe("paths", () => {
  const cwd = "/tmp/some-project";

  it("resolves the roadmap dir under docs/roadmap", () => {
    expect(roadmapDir(cwd)).toBe(path.join(cwd, "docs", "roadmap"));
  });

  it("resolves items.jsonl inside the roadmap dir", () => {
    expect(itemsFilePath(cwd)).toBe(path.join(cwd, "docs", "roadmap", "items.jsonl"));
  });

  it("resolves sprints.json inside the roadmap dir", () => {
    expect(sprintsFilePath(cwd)).toBe(path.join(cwd, "docs", "roadmap", "sprints.json"));
  });

  it("resolves specs dir inside the roadmap dir", () => {
    expect(specsDir(cwd)).toBe(path.join(cwd, "docs", "roadmap", "specs"));
  });

  it("resolves a spec file path by item id", () => {
    expect(specFilePath(cwd, 12)).toBe(
      path.join(cwd, "docs", "roadmap", "specs", "12.md"),
    );
  });
});
