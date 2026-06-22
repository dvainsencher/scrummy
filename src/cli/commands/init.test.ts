import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issuesFilePath, specsDir, sprintsFilePath } from "../../storage/paths.js";
import { readIssues } from "../../storage/issuesStore.js";
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

  it("creates an empty issues.jsonl", () => {
    init(cwd);
    expect(fs.existsSync(issuesFilePath(cwd))).toBe(true);
    expect(readIssues(cwd)).toEqual([]);
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
    fs.writeFileSync(issuesFilePath(cwd), `${JSON.stringify({ id: 1 })}\n`);
    init(cwd);
    expect(fs.readFileSync(issuesFilePath(cwd), "utf8")).toContain('"id":1');
  });

  it("refuses to init when docs/roadmap/ already exists with non-pauta content", () => {
    fs.mkdirSync(path.join(cwd, "docs", "roadmap"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "docs", "roadmap", "ROADMAP.md"), "# legacy backlog\n");
    expect(() => init(cwd)).toThrow(/docs\/roadmap-legacy/);
    expect(fs.existsSync(issuesFilePath(cwd))).toBe(false);
  });

  it("recovers from an init interrupted after specsDir was created but before issues.jsonl was written", () => {
    fs.mkdirSync(specsDir(cwd), { recursive: true });
    expect(() => init(cwd)).not.toThrow();
    expect(fs.existsSync(issuesFilePath(cwd))).toBe(true);
    expect(readIssues(cwd)).toEqual([]);
  });
});
