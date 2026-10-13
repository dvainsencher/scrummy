import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCanonicalBranch, resolveRoadmapRoot } from "./root.js";

// Builds git's on-disk layout by hand: scrummy reads these files, it never runs git.
function makePrimary(dir: string, head = "ref: refs/heads/main\n"): void {
  fs.mkdirSync(path.join(dir, ".git", "worktrees"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".git", "HEAD"), head);
  fs.mkdirSync(path.join(dir, "docs", "roadmap"), { recursive: true });
}

function makeLinked(primary: string, linked: string, name: string, head = "ref: refs/heads/feat/x\n"): void {
  const adminDir = path.join(primary, ".git", "worktrees", name);
  fs.mkdirSync(adminDir, { recursive: true });
  fs.writeFileSync(path.join(adminDir, "commondir"), "../..\n");
  fs.writeFileSync(path.join(adminDir, "HEAD"), head);
  fs.mkdirSync(linked, { recursive: true });
  fs.writeFileSync(path.join(linked, ".git"), `gitdir: ${adminDir}\n`);
}

describe("resolveRoadmapRoot", () => {
  let tmp: string;
  let primary: string;
  let linked: string;

  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-root-")));
    primary = path.join(tmp, "main-checkout");
    linked = path.join(tmp, "linked");
    makePrimary(primary);
    makeLinked(primary, linked, "linked");
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("uses cwd for a plain checkout", () => {
    expect(resolveRoadmapRoot(primary, {})).toEqual({ root: primary, rule: "cwd" });
  });

  it("maps a linked worktree onto the primary checkout", () => {
    const resolved = resolveRoadmapRoot(linked, {});
    expect(resolved.root).toBe(primary);
    expect(resolved.rule).toBe("worktree");
  });

  it("keeps cwd when the primary checkout has no docs/roadmap yet", () => {
    fs.rmSync(path.join(primary, "docs"), { recursive: true });
    expect(resolveRoadmapRoot(linked, {})).toEqual({ root: linked, rule: "cwd" });
  });

  it("lets SCRUMMY_ROOT override everything", () => {
    const resolved = resolveRoadmapRoot(linked, { SCRUMMY_ROOT: tmp });
    expect(resolved).toEqual({ root: tmp, rule: "env" });
  });

  it("lets config.json roadmapRoot (relative to cwd) beat worktree detection", () => {
    const elsewhere = path.join(tmp, "roadmap-wt");
    fs.mkdirSync(elsewhere);
    fs.mkdirSync(path.join(linked, "docs", "roadmap"), { recursive: true });
    fs.writeFileSync(
      path.join(linked, "docs", "roadmap", "config.json"),
      JSON.stringify({ roadmapRoot: "../roadmap-wt" }),
    );
    expect(resolveRoadmapRoot(linked, {})).toEqual({ root: elsewhere, rule: "config" });
  });
});

describe("assertCanonicalBranch", () => {
  let tmp: string;
  let primary: string;
  let linked: string;

  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-guard-")));
    primary = path.join(tmp, "main-checkout");
    linked = path.join(tmp, "linked");
    makePrimary(primary);
    makeLinked(primary, linked, "linked");
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("passes when the canonical checkout is on main", () => {
    const resolved = resolveRoadmapRoot(linked, {});
    expect(() => assertCanonicalBranch(resolved, linked, {})).not.toThrow();
  });

  it("refuses when the canonical checkout is on a feature branch", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/feat/other\n");
    const resolved = resolveRoadmapRoot(linked, {});
    expect(() => assertCanonicalBranch(resolved, linked, {})).toThrow(/feat\/other.*main/s);
  });

  it("refuses a detached HEAD", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "0123456789abcdef\n");
    const resolved = resolveRoadmapRoot(linked, {});
    expect(() => assertCanonicalBranch(resolved, linked, {})).toThrow(/detached/);
  });

  it("honours mainBranch from config.json", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/trunk\n");
    fs.writeFileSync(path.join(primary, "docs", "roadmap", "config.json"), JSON.stringify({ mainBranch: "trunk" }));
    const resolved = resolveRoadmapRoot(linked, {});
    expect(() => assertCanonicalBranch(resolved, linked, {})).not.toThrow();
  });

  it("can be overridden explicitly", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/feat/other\n");
    const resolved = resolveRoadmapRoot(linked, {});
    expect(() => assertCanonicalBranch(resolved, linked, {}, { allowBranch: true })).not.toThrow();
    expect(() => assertCanonicalBranch(resolved, linked, { SCRUMMY_ALLOW_BRANCH: "1" })).not.toThrow();
  });

  it("does not guard a plain checkout working on its own branch", () => {
    fs.writeFileSync(path.join(primary, ".git", "HEAD"), "ref: refs/heads/feat/mine\n");
    const resolved = resolveRoadmapRoot(primary, {});
    expect(() => assertCanonicalBranch(resolved, primary, {})).not.toThrow();
  });
});
