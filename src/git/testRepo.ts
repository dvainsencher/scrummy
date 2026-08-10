// Test-only helper: spins up a real bare "remote" repo plus real clones of it, so
// sync.test.ts can exercise actual git plumbing (fetch/reset/worktree/push races)
// instead of mocking git — the whole point of this module is to get that plumbing
// right, so a mock would hide exactly the bugs it exists to catch.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { generateRoadmapMarkdown } from "../cli/commands/roadmap.js";

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} (cwd=${cwd}) failed:\n${result.stderr}`);
  }
}

function configureIdentity(cwd: string): void {
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Test"]);
}

export interface TestRemote {
  bareDir: string;
  /** A clone with docs/roadmap/ already initialized, committed, and pushed to main. */
  primaryDir: string;
  cleanup(): void;
}

export function cloneOf(remote: TestRemote): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-clone-"));
  git(dir, ["clone", remote.bareDir, "."]);
  configureIdentity(dir);
  git(dir, ["remote", "set-head", "origin", "main"]);
  return dir;
}

export function createTestRemote(initFn: (cwd: string) => void): TestRemote {
  const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-bare-"));
  fs.rmdirSync(bareDir);
  git(path.dirname(bareDir), ["init", "--bare", "--initial-branch=main", bareDir]);

  const seedDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-seed-"));
  git(seedDir, ["clone", bareDir, "."]);
  configureIdentity(seedDir);
  initFn(seedDir);
  // Match real usage: every mutating command regenerates ROADMAP.md (see
  // bin/scrummy.ts), so a real repo's baseline always has one committed.
  generateRoadmapMarkdown(seedDir);
  git(seedDir, ["add", "-A"]);
  git(seedDir, ["commit", "-m", "seed"]);
  git(seedDir, ["push", "origin", "main"]);
  fs.rmSync(seedDir, { recursive: true, force: true });

  const primaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-primary-"));
  git(primaryDir, ["clone", bareDir, "."]);
  configureIdentity(primaryDir);
  git(primaryDir, ["remote", "set-head", "origin", "main"]);

  return {
    bareDir,
    primaryDir,
    cleanup(): void {
      fs.rmSync(bareDir, { recursive: true, force: true });
      fs.rmSync(primaryDir, { recursive: true, force: true });
    },
  };
}
