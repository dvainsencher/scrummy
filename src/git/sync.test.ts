import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "../cli/commands/init.js";
import { addIssue } from "../cli/commands/addIssue.js";
import { readIssues } from "../storage/issuesStore.js";
import { assertNoDuplicateIds } from "../domain/validation.js";
import { cloneOf, createTestRemote, type TestRemote } from "./testRepo.js";
import { detectSyncTarget, GitSyncError, runWithGitSync, type LandFn } from "./sync.js";

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} (cwd=${cwd}) failed:\n${result.stderr}`);
  }
}

// Stands in for the real gh-PR-based `landViaGhPr` — a direct push of the synced
// branch onto the base branch has the same git-history effect as a squash merge for
// what these tests need to prove (fast-forward vs. race), without touching GitHub.
function directPushLand(): LandFn {
  return (cwd, branch, base, remote) => {
    const result = spawnSync("git", ["push", remote, `${branch}:${base}`], { cwd, encoding: "utf8" });
    return result.status === 0 ? { ok: true } : { ok: false, error: result.stderr };
  };
}

describe("detectSyncTarget", () => {
  let remote: TestRemote;
  let cwd: string;
  const originalEnv = process.env.SCRUMMY_NO_SYNC;

  beforeEach(() => {
    remote = createTestRemote((seedDir) => init(seedDir));
    cwd = remote.primaryDir;
  });

  afterEach(() => {
    remote.cleanup();
    if (originalEnv === undefined) delete process.env.SCRUMMY_NO_SYNC;
    else process.env.SCRUMMY_NO_SYNC = originalEnv;
  });

  it("finds origin/main as the sync target when gh is available", () => {
    expect(detectSyncTarget(cwd, { hasGh: () => true })).toEqual({ remote: "origin", branch: "main" });
  });

  it("returns undefined when gh is not available", () => {
    expect(detectSyncTarget(cwd, { hasGh: () => false })).toBeUndefined();
  });

  it("returns undefined when SCRUMMY_NO_SYNC is set", () => {
    process.env.SCRUMMY_NO_SYNC = "1";
    expect(detectSyncTarget(cwd, { hasGh: () => true })).toBeUndefined();
  });

  it("returns undefined for a directory that isn't a git repo", () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-not-a-repo-"));
    try {
      expect(detectSyncTarget(plain, { hasGh: () => true })).toBeUndefined();
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  it("returns undefined when the repo has no origin remote", () => {
    const noRemote = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-no-remote-"));
    try {
      git(noRemote, ["init", "--initial-branch=main"]);
      expect(detectSyncTarget(noRemote, { hasGh: () => true })).toBeUndefined();
    } finally {
      fs.rmSync(noRemote, { recursive: true, force: true });
    }
  });
});

describe("runWithGitSync", () => {
  let remote: TestRemote;
  let cwd: string;

  beforeEach(() => {
    remote = createTestRemote((seedDir) => init(seedDir));
    cwd = remote.primaryDir;
  });

  afterEach(() => {
    remote.cleanup();
  });

  it("lands the mutation on the base branch and returns the handler's result", () => {
    const target = { remote: "origin", branch: "main" };
    const id = runWithGitSync(cwd, target, "add-issue", (workDir) => addIssue(workDir, "Dark mode"), directPushLand());

    expect(id).toBe(1);

    const check = cloneOf(remote);
    try {
      expect(readIssues(check).map((issue) => issue.title)).toEqual(["Dark mode"]);
    } finally {
      fs.rmSync(check, { recursive: true, force: true });
    }
  });

  it("returns the handler's result without landing anything when nothing changed", () => {
    const target = { remote: "origin", branch: "main" };
    let landCalls = 0;
    const land: LandFn = (...args) => {
      landCalls++;
      return directPushLand()(...args);
    };

    const result = runWithGitSync(cwd, target, "no-op", () => "unchanged", land);

    expect(result).toBe("unchanged");
    expect(landCalls).toBe(0);
  });

  it("retries the whole mutation against fresh state when a concurrent writer lands first", () => {
    const target = { remote: "origin", branch: "main" };
    let landCalls = 0;
    let fnCalls = 0;

    const land: LandFn = (...args) => {
      landCalls++;
      if (landCalls === 1) {
        // Simulate a rival session landing its own scrummy mutation on origin/main
        // in the gap between this attempt's fetch and its own land attempt.
        const rival = cloneOf(remote);
        try {
          addIssue(rival, "Rival's issue");
          git(rival, ["add", "-A"]);
          git(rival, ["commit", "-m", "scrummy: add-issue (rival)"]);
          git(rival, ["push", "origin", "main"]);
        } finally {
          fs.rmSync(rival, { recursive: true, force: true });
        }
        return { ok: false, error: "simulated non-fast-forward" };
      }
      return directPushLand()(...args);
    };

    const id = runWithGitSync(
      cwd,
      target,
      "add-issue",
      (workDir) => {
        fnCalls++;
        return addIssue(workDir, "My issue");
      },
      land,
    );

    // The retry must have re-run the handler against the rebased state — if it had
    // reused the first attempt's id, this would be a duplicate (id 1, colliding with
    // the rival's issue), which is exactly the bug this whole feature exists to rule
    // out. See domain/ids.ts (nextId) and the `validate` command.
    expect(fnCalls).toBe(2);
    expect(id).toBe(2);

    const check = cloneOf(remote);
    try {
      const issues = readIssues(check);
      expect(issues.map((issue) => issue.title)).toEqual(["Rival's issue", "My issue"]);
      expect(() => assertNoDuplicateIds(issues)).not.toThrow();
    } finally {
      fs.rmSync(check, { recursive: true, force: true });
    }
  });

  it("throws GitSyncError after exhausting retries when landing never succeeds", () => {
    const target = { remote: "origin", branch: "main" };
    const alwaysFails: LandFn = () => ({ ok: false, error: "simulated permanent failure" });

    expect(() =>
      runWithGitSync(cwd, target, "add-issue", (workDir) => addIssue(workDir, "Doomed"), alwaysFails),
    ).toThrow(GitSyncError);
  });

  it("removes the temporary worktree it created, win or lose", () => {
    const target = { remote: "origin", branch: "main" };
    const before = spawnSync("git", ["worktree", "list"], { cwd, encoding: "utf8" }).stdout;

    runWithGitSync(cwd, target, "add-issue", (workDir) => addIssue(workDir, "Dark mode"), directPushLand());

    const after = spawnSync("git", ["worktree", "list"], { cwd, encoding: "utf8" }).stdout;
    expect(after.trim().split("\n").length).toBe(before.trim().split("\n").length);
  });
});
