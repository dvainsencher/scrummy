import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readItems } from "../storage/itemsStore.js";
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
    expect(readItems(cwd)).toEqual([]);
    expect(readSprints(cwd)).toEqual([]);
  });

  it("add-item returns the new id as a string", () => {
    commands.init(cwd, []);
    const id = commands["add-item"](cwd, ["Dark mode"]);
    expect(id).toBe("1");
    expect(readItems(cwd)[0].title).toBe("Dark mode");
  });

  it("create-sprint then add-item --sprint assigns it", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "build it"]);
    commands["add-item"](cwd, ["Dark mode", "--sprint", "foundation"]);
    expect(readItems(cwd)[0].sprint).toBe("foundation");
  });

  it("move --backlog sends an item back to the backlog", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "g"]);
    commands["add-item"](cwd, ["Dark mode", "--sprint", "foundation"]);
    commands.move(cwd, ["1", "--backlog"]);
    expect(readItems(cwd)[0].sprint).toBe("");
  });

  it("set-active marks the sprint active", () => {
    commands.init(cwd, []);
    commands["create-sprint"](cwd, ["foundation", "--goal", "g"]);
    commands["set-active"](cwd, ["foundation"]);
    expect(readSprints(cwd)[0].status).toBe("active");
  });

  it("spec returns the spec file path", () => {
    commands.init(cwd, []);
    commands["add-item"](cwd, ["Dark mode"]);
    const result = commands.spec(cwd, ["1"]);
    expect(typeof result).toBe("string");
    expect(fs.existsSync(result as string)).toBe(true);
  });

  it("show renders the backlog by default", () => {
    commands.init(cwd, []);
    commands["add-item"](cwd, ["Dark mode"]);
    const result = commands.show(cwd, []);
    expect(result).toContain("Dark mode");
  });

  it("show --json renders structured data", () => {
    commands.init(cwd, []);
    commands["add-item"](cwd, ["Dark mode"]);
    const result = commands.show(cwd, ["--json"]) as string;
    expect(JSON.parse(result).backlog[0].title).toBe("Dark mode");
  });
});
