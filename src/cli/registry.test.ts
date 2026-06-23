import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "../storage/issuesStore.js";
import { readSprints } from "../storage/sprintsStore.js";
import { commands } from "./registry.js";

describe("command registry", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("init scaffolds the roadmap dir", () => {
    commands.init(cwd, []);
    expect(readIssues(cwd)).toEqual([]);
    expect(readSprints(cwd)).toEqual([]);
  });

  it("add-issue returns the new id as a string", () => {
    commands.init(cwd, []);
    const id = commands["add-issue"](cwd, ["Dark mode"]);
    expect(id).toBe("1");
    expect(readIssues(cwd)[0].title).toBe("Dark mode");
  });

  it("create-sprint then add-issue --sprint assigns it", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "build it"]);
    commands["add-issue"](cwd, ["Dark mode", "--sprint", "foundation"]);
    expect(readIssues(cwd)[0].sprint).toBe("foundation");
  });

  it("move --backlog sends an issue back to the backlog", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "g"]);
    commands["add-issue"](cwd, ["Dark mode", "--sprint", "foundation"]);
    commands.move(cwd, ["1", "--backlog"]);
    expect(readIssues(cwd)[0].sprint).toBe("");
  });

  it("remove-sprint deletes an empty sprint", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "g"]);
    commands["remove-sprint"](cwd, ["foundation"]);
    expect(readSprints(cwd)).toEqual([]);
  });

  it("set-active marks the sprint active", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "g"]);
    commands["set-active"](cwd, ["foundation"]);
    expect(readSprints(cwd)[0].status).toBe("active");
  });

  it("spec returns the spec file path", () => {
    commands.init(cwd, []);
    commands["add-issue"](cwd, ["Dark mode"]);
    const result = commands.spec(cwd, ["1"]);
    expect(typeof result).toBe("string");
    expect(fs.existsSync(result as string)).toBe(true);
  });

  it("show renders the backlog by default", () => {
    commands.init(cwd, []);
    commands["add-issue"](cwd, ["Dark mode"]);
    const result = commands.show(cwd, []);
    expect(result).toContain("Dark mode");
  });

  it("show --json renders structured data", () => {
    commands.init(cwd, []);
    commands["add-issue"](cwd, ["Dark mode"]);
    const result = commands.show(cwd, ["--json"]) as string;
    expect(JSON.parse(result).backlog[0].title).toBe("Dark mode");
  });

  it("import reads a JSON file of issues and returns the new ids", () => {
    commands.init(cwd, []);
    const filePath = path.join(cwd, "import.json");
    fs.writeFileSync(filePath, JSON.stringify([{ title: "first" }, { title: "second" }]));
    const result = commands.import(cwd, [filePath]);
    expect(result).toBe("1\n2");
    expect(readIssues(cwd).map((issue) => issue.title)).toEqual(["first", "second"]);
  });

  it("log-issue appends a progress entry, then show --json reports hasLog", () => {
    commands.init(cwd, []);
    commands["add-issue"](cwd, ["Dark mode"]);
    commands["log-issue"](cwd, ["1", "investigate root cause", "--type", "plan"]);
    const result = JSON.parse(commands.show(cwd, ["--json"]) as string);
    expect(result.backlog[0].hasLog).toBe(true);
  });

  it("log-issue requires a --type flag", () => {
    commands.init(cwd, []);
    commands["add-issue"](cwd, ["Dark mode"]);
    expect(() => commands["log-issue"](cwd, ["1", "investigate"])).toThrow(/--type/);
  });

  it("show-log returns the logged entries for an issue as JSON", () => {
    commands.init(cwd, []);
    commands["add-issue"](cwd, ["Dark mode"]);
    commands["log-issue"](cwd, ["1", "investigate root cause", "--type", "plan"]);
    const entries = JSON.parse(commands["show-log"](cwd, ["1"]) as string);
    expect(entries).toMatchObject([{ issueId: 1, type: "plan", message: "investigate root cause" }]);
  });

  it("install-skills copies the shipped skills into .claude/skills/", () => {
    commands["install-skills"](cwd, []);
    expect(
      fs.existsSync(path.join(cwd, ".claude", "skills", "pauta-add-issue", "SKILL.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(cwd, ".claude", "skills", "pauta-reorganize", "SKILL.md")),
    ).toBe(true);
  });
});
