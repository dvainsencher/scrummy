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

  it("falls back to a master branch when origin/HEAD has no symbolic ref set", () => {
    // A clone made with `git clone --no-single-branch` or one whose remote never
    // reported HEAD can end up without refs/remotes/origin/HEAD — detectSyncTarget
    // must still find the branch by probing for main/master directly.
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-bare-master-"));
    fs.rmdirSync(bareDir);
    git(path.dirname(bareDir), ["init", "--bare", "--initial-branch=master", bareDir]);

    const seedDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-seed-master-"));
    git(seedDir, ["clone", bareDir, "."]);
    git(seedDir, ["config", "user.email", "test@example.com"]);
    git(seedDir, ["config", "user.name", "Test"]);
    init(seedDir);
    git(seedDir, ["add", "-A"]);
    git(seedDir, ["commit", "-m", "seed"]);
    git(seedDir, ["push", "origin", "master"]);

    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-clone-master-"));
    git(cloneDir, ["clone", bareDir, "."]);
    // Deliberately do NOT set refs/remotes/origin/HEAD, to exercise the fallback.

    try {
      expect(detectSyncTarget(cloneDir, { hasGh: () => true })).toEqual({ remote: "origin", branch: "master" });
    } finally {
      fs.rmSync(bareDir, { recursive: true, force: true });
      fs.rmSync(seedDir, { recursive: true, force: true });
      fs.rmSync(cloneDir, { recursive: true, force: true });
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

  it("leaves no local scrummy/* branch behind after exhausting retries", () => {
    const target = { remote: "origin", branch: "main" };
    const before = spawnSync("git", ["branch", "--list", "scrummy/*"], { cwd, encoding: "utf8" }).stdout;
    expect(before.trim()).toBe("");

    expect(() =>
      runWithGitSync(cwd, target, "add-issue", (workDir) => addIssue(workDir, "Doomed"), () => ({
        ok: false,
        error: "simulated permanent failure",
      })),
    ).toThrow(GitSyncError);

    const after = spawnSync("git", ["branch", "--list", "scrummy/*"], { cwd, encoding: "utf8" }).stdout;
    expect(after.trim()).toBe("");
  });

  it("recovers after two consecutive races, succeeding on the third and final attempt", () => {
    const target = { remote: "origin", branch: "main" };
    let landCalls = 0;
    let fnCalls = 0;

    const land: LandFn = (...args) => {
      landCalls++;
      if (landCalls <= 2) {
        return { ok: false, error: `simulated race #${landCalls}` };
      }
      return directPushLand()(...args);
    };

    const id = runWithGitSync(
      cwd,
      target,
      "add-issue",
      (workDir) => {
        fnCalls++;
        return addIssue(workDir, "Third time's the charm");
      },
      land,
    );

    expect(fnCalls).toBe(3);
    expect(id).toBe(1); // no rival ever actually landed here — only the land step was faked to fail
  });

  it("propagates a business-logic error without ever attempting to land, and still cleans up", () => {
    const target = { remote: "origin", branch: "main" };
    let landCalls = 0;
    const land: LandFn = (...args) => {
      landCalls++;
      return directPushLand()(...args);
    };
    const worktreesBefore = spawnSync("git", ["worktree", "list"], { cwd, encoding: "utf8" }).stdout;

    expect(() =>
      runWithGitSync(
        cwd,
        target,
        "add-issue",
        // "missing-sprint" doesn't exist — addIssue throws before writing anything.
        (workDir) => addIssue(workDir, "x", { sprint: "missing-sprint" }),
        land,
      ),
    ).toThrow(/missing-sprint/);

    expect(landCalls).toBe(0);
    const worktreesAfter = spawnSync("git", ["worktree", "list"], { cwd, encoding: "utf8" }).stdout;
    expect(worktreesAfter.trim().split("\n").length).toBe(worktreesBefore.trim().split("\n").length);
  });

  // This is a regression test for a real bug hit running this feature live: scrummy's
  // own .githooks/pre-commit runs `npm run build`, which fails in a fresh sync
  // worktree (no node_modules), which aborted every commit and made every mutating
  // command fail after burning through all retries. A sync commit only ever touches
  // docs/roadmap/*+ROADMAP.md — a source-build hook has nothing relevant to check —
  // so the fix is committing with --no-verify, which this proves actually happens.
  it("lands successfully even when a pre-commit hook would otherwise reject every commit", () => {
    const hooksDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-hooks-"));
    fs.writeFileSync(path.join(hooksDir, "pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    git(cwd, ["config", "core.hooksPath", hooksDir]);

    try {
      const target = { remote: "origin", branch: "main" };
      const id = runWithGitSync(cwd, target, "add-issue", (workDir) => addIssue(workDir, "Dark mode"), directPushLand());
      expect(id).toBe(1);
    } finally {
      fs.rmSync(hooksDir, { recursive: true, force: true });
    }
  });

  it("shares the calling worktree's node_modules with the sync worktree, when present", () => {
    const fakeModules = path.join(cwd, "node_modules");
    fs.mkdirSync(fakeModules);
    fs.writeFileSync(path.join(fakeModules, "marker.txt"), "present");

    try {
      const target = { remote: "origin", branch: "main" };
      let sawNodeModules = false;
      runWithGitSync(
        cwd,
        target,
        "add-issue",
        (workDir) => {
          sawNodeModules = fs.existsSync(path.join(workDir, "node_modules", "marker.txt"));
          return addIssue(workDir, "Dark mode");
        },
        directPushLand(),
      );

      expect(sawNodeModules).toBe(true);
    } finally {
      fs.rmSync(fakeModules, { recursive: true, force: true });
    }
  });
});
