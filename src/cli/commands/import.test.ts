import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "../../storage/issuesStore.js";
import { createSprint } from "./createSprint.js";
import { importFromFile } from "./import.js";
import { init } from "./init.js";

describe("importFromFile", () => {
  let cwd: string;
  let filePath: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    filePath = path.join(cwd, "import.json");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("imports a batch of issues in one write, returning their ids", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ title: "first" }, { title: "second", status: "ready" }]),
    );
    const ids = importFromFile(cwd, filePath);
    expect(ids).toEqual([1, 2]);
    const issues = readIssues(cwd);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ id: 1, title: "first", status: "idea", sprint: "" });
    expect(issues[1]).toMatchObject({ id: 2, title: "second", status: "ready", sprint: "" });
  });

  it("assigns ids after existing issues", () => {
    fs.writeFileSync(filePath, JSON.stringify([{ title: "existing" }]));
    importFromFile(cwd, filePath);
    fs.writeFileSync(filePath, JSON.stringify([{ title: "new one" }]));
    const ids = importFromFile(cwd, filePath);
    expect(ids).toEqual([2]);
  });

  it("accepts a sprint that exists", () => {
    createSprint(cwd, "foundation", { goal: "g" });
    fs.writeFileSync(filePath, JSON.stringify([{ title: "first", sprint: "foundation" }]));
    importFromFile(cwd, filePath);
    expect(readIssues(cwd)[0].sprint).toBe("foundation");
  });

  it("rejects the whole batch (no partial write) when one entry has an unknown sprint", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ title: "first" }, { title: "second", sprint: "missing" }]),
    );
    expect(() => importFromFile(cwd, filePath)).toThrow(/missing/);
    expect(readIssues(cwd)).toHaveLength(0);
  });

  it("rejects the whole batch when one entry has an invalid status", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify([{ title: "first" }, { title: "second", status: "bogus" }]),
    );
    expect(() => importFromFile(cwd, filePath)).toThrow(/bogus/);
    expect(readIssues(cwd)).toHaveLength(0);
  });

  it("rejects an entry missing a title", () => {
    fs.writeFileSync(filePath, JSON.stringify([{ status: "ready" }]));
    expect(() => importFromFile(cwd, filePath)).toThrow(/title/);
    expect(readIssues(cwd)).toHaveLength(0);
  });

  it("rejects a file that is not a JSON array", () => {
    fs.writeFileSync(filePath, JSON.stringify({ title: "not an array" }));
    expect(() => importFromFile(cwd, filePath)).toThrow(/array/);
  });

  it("rejects a file that is not valid JSON", () => {
    fs.writeFileSync(filePath, "not json");
    expect(() => importFromFile(cwd, filePath)).toThrow(/JSON/);
  });

  it("rejects a missing file", () => {
    expect(() => importFromFile(cwd, path.join(cwd, "missing.json"))).toThrow();
  });
});
