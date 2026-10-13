import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isEntryPoint, main } from "./scrummy.js";

describe("main", () => {
  let cwd: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-test-"));
    stdout = [];
    stderr = [];
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  function run(argv: string[]) {
    return main({
      argv,
      cwd,
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });
  }

  it("prints usage and exits 0 on bare invocation", () => {
    const exitCode = run([]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Usage: scrummy <command> [args]");
  });

  it("prints usage and exits 0 on --help", () => {
    const exitCode = run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Usage: scrummy <command> [args]");
  });

  it("prints usage and exits 0 on -h", () => {
    const exitCode = run(["-h"]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Usage: scrummy <command> [args]");
  });

  it("prints an unknown-command error with a hint and exits 1", () => {
    const exitCode = run(["bogus"]);
    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("Unknown command: bogus");
    expect(stderr.join("")).toContain('Run "scrummy --help"');
  });

  it("dispatches a known command and prints its result", () => {
    const exitCode = run(["init"]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Initialized docs/roadmap/");
  });

  it("prints the error message and exits 1 when a handler throws", () => {
    const exitCode = run(["edit-issue", "999", "--title", "x"]);
    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("999");
  });

  it("exits 1 with an error when show receives a non-numeric id", () => {
    run(["init"]);
    const exitCode = run(["show", "foo"]);
    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("foo");
  });

  it("regenerates ROADMAP.md after a mutating command like add-issue", () => {
    run(["init"]);
    run(["add-issue", "Dark mode"]);
    const content = fs.readFileSync(path.join(cwd, "ROADMAP.md"), "utf8");
    expect(content).toContain("Dark mode");
  });

  it("does not write ROADMAP.md for a read-only command like show", () => {
    run(["init"]);
    fs.rmSync(path.join(cwd, "ROADMAP.md"), { force: true });
    run(["show"]);
    expect(fs.existsSync(path.join(cwd, "ROADMAP.md"))).toBe(false);
  });
});

describe("isEntryPoint", () => {
  const scrummyPath = path.join(import.meta.dirname, "scrummy.ts");
  const scrummyUrl = pathToFileURL(scrummyPath).href;

  it("returns true when argv[1] is the real path to the module", () => {
    expect(isEntryPoint(scrummyPath, scrummyUrl)).toBe(true);
  });

  it("resolves a symlinked argv[1] (e.g. node_modules/.bin/scrummy) to the real module path", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-symlink-"));
    const symlinkPath = path.join(tmpDir, "scrummy-bin");
    fs.symlinkSync(scrummyPath, symlinkPath);

    expect(isEntryPoint(symlinkPath, scrummyUrl)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false for an unrelated path", () => {
    expect(isEntryPoint("/some/unrelated/file.js", scrummyUrl)).toBe(false);
  });

  it("returns false when argv[1] is undefined", () => {
    expect(isEntryPoint(undefined, scrummyUrl)).toBe(false);
  });
});

describe("main in a linked worktree", () => {
  let tmp: string;
  let primary: string;
  let linked: string;
  let out: string[];
  let err: string[];

  function run(argv: string[], cwd: string) {
    return main({ argv, cwd, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  }

  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-wt-")));
    primary = path.join(tmp, "primary");
    linked = path.join(tmp, "linked");
    out = [];
    err = [];
    const adminDir = path.join(primary, ".git", "worktrees", "linked");
    fs.mkdirSync(adminDir, { recursive: true });
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(path.join(adminDir, "commondir"), "../..\n");
    fs.mkdirSync(linked);
    fs.writeFileSync(path.join(linked, ".git"), `gitdir: ${adminDir}\n`);
    expect(run(["init"], primary)).toBe(0);
    out = [];
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("writes to the primary checkout and shares ids across worktrees", () => {
    expect(run(["add-issue", "from primary"], primary)).toBe(0);
    expect(run(["add-issue", "from linked"], linked)).toBe(0);
    expect(out.join("").trim().split("\n")).toEqual(["1", "2"]);
    expect(fs.existsSync(path.join(linked, "docs"))).toBe(false);
    expect(fs.existsSync(path.join(primary, "docs", "roadmap", "issues", "2.json"))).toBe(true);
  });

  it("refuses a mutation while the primary checkout is on a feature branch", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/feat/x\n");
    expect(run(["add-issue", "nope"], linked)).toBe(1);
    expect(err.join("")).toContain("feat/x");
    expect(run(["add-issue", "forced", "--allow-branch"], linked)).toBe(0);
  });

  it("still lets reads through on a feature branch", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/feat/x\n");
    expect(run(["show"], linked)).toBe(0);
  });

  it("`where` reports the resolved root and the rule", () => {
    expect(run(["where"], linked)).toBe(0);
    const text = out.join("");
    expect(text).toContain(primary);
    expect(text).toContain("linked git worktree");
  });
});
