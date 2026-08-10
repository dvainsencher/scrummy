// Mandatory sync for docs/roadmap/* mutations, so scrummy is safe to run from
// multiple worktrees/sessions at once. Every mutating command lands as its own
// tiny, immediately-merged PR against the repo's default branch — see
// docs/architecture.md "Parallel use" for why: a direct push to main isn't just
// bad practice here, it's blocked outright, and an opt-in flag gets forgotten.
//
// The core guarantee: `fn` is re-run from scratch, against freshly-fetched state,
// on every retry — never replayed with stale data. That's what makes two concurrent
// `add-issue` calls land with different ids instead of colliding (see domain/ids.ts).
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateRoadmapMarkdown } from "../cli/commands/roadmap.js";

const MAX_ATTEMPTS = 3;

interface ShellResult {
  status: number;
  stdout: string;
  stderr: string;
}

function sh(cmd: string, args: string[], cwd: string): ShellResult {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export interface SyncTarget {
  remote: string;
  branch: string;
}

export interface DetectSyncTargetOptions {
  hasGh?: () => boolean;
}

const defaultHasGh = (): boolean => spawnSync("gh", ["--version"]).status === 0;

// Undefined means "sync doesn't apply here" — the caller should fall back to a
// plain local write, exactly as scrummy has always behaved. That's deliberate for:
// no git repo, no origin remote, no gh CLI, or the explicit SCRUMMY_NO_SYNC escape
// hatch (solo/offline use, where there's no concurrent writer to race with).
export function detectSyncTarget(cwd: string, options: DetectSyncTargetOptions = {}): SyncTarget | undefined {
  const hasGh = options.hasGh ?? defaultHasGh;

  if (process.env.SCRUMMY_NO_SYNC) {
    return undefined;
  }
  if (sh("git", ["rev-parse", "--is-inside-work-tree"], cwd).stdout.trim() !== "true") {
    return undefined;
  }
  const symbolic = sh("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
  let branch = symbolic.status === 0 ? symbolic.stdout.trim().split("/").pop() : undefined;
  if (!branch) {
    for (const candidate of ["main", "master"]) {
      if (sh("git", ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${candidate}`], cwd).status === 0) {
        branch = candidate;
        break;
      }
    }
  }
  if (!branch) {
    return undefined;
  }
  if (!hasGh()) {
    return undefined;
  }
  return { remote: "origin", branch };
}

export class GitSyncError extends Error {}

export interface LandResult {
  ok: boolean;
  error?: string;
}

// Push the synced branch and land it on `base` — real usage squash-merges a PR via
// gh so it always goes through review-triage's skip lane, never a direct push.
export type LandFn = (cwd: string, branch: string, base: string, remote: string, label: string) => LandResult;

export const landViaGhPr: LandFn = (cwd, branch, base, remote, label) => {
  const push = sh("git", ["push", remote, branch], cwd);
  if (push.status !== 0) {
    return { ok: false, error: push.stderr.trim() };
  }
  const pr = sh("gh", ["pr", "create", "--head", branch, "--base", base, "--title", `scrummy: ${label}`, "--body", ""], cwd);
  if (pr.status !== 0) {
    sh("git", ["push", remote, "--delete", branch], cwd); // best-effort cleanup
    return { ok: false, error: pr.stderr.trim() };
  }
  const prUrl = pr.stdout.trim();
  const merge = sh("gh", ["pr", "merge", "--squash", "--delete-branch", prUrl], cwd);
  if (merge.status !== 0) {
    sh("gh", ["pr", "close", "--delete-branch", prUrl], cwd); // best-effort cleanup
    return { ok: false, error: merge.stderr.trim() };
  }
  return { ok: true };
};

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "mutation";
}

// Runs `fn` under a fetch → mutate → commit → land retry loop, scoped to a disposable
// worktree pinned to the target branch. The calling worktree (`originalCwd`) is never
// touched — its checked-out branch and any unrelated uncommitted work are left alone,
// which is what makes this safe to call from an execution worktree mid-feature-work.
export function runWithGitSync<T>(
  originalCwd: string,
  target: SyncTarget,
  commandLabel: string,
  fn: (workDir: string) => T,
  land: LandFn = landViaGhPr,
): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-sync-"));
  const upstreamRef = `${target.remote}/${target.branch}`;
  // One branch per call, reused across retries (reset in place below) — not
  // recreated per attempt, so a failed attempt never leaves stray local branches.
  const branchName = `scrummy/${slug(commandLabel)}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

  const addWorktree = sh("git", ["worktree", "add", "-b", branchName, tmpDir, upstreamRef], originalCwd);
  if (addWorktree.status !== 0) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new GitSyncError(`Couldn't create a sync worktree: ${addWorktree.stderr.trim()}`);
  }

  // node_modules is gitignored and per-worktree — a fresh worktree checkout doesn't
  // have one. Share the calling worktree's, since these commits never touch source
  // anyway (see the --no-verify note below); best-effort, only helps hooks that peek
  // at node_modules, never required for the sync mechanism itself.
  const sharedModules = path.join(originalCwd, "node_modules");
  if (fs.existsSync(sharedModules)) {
    try {
      fs.symlinkSync(sharedModules, path.join(tmpDir, "node_modules"), "dir");
    } catch {
      // best-effort
    }
  }

  try {
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      sh("git", ["fetch", target.remote, target.branch], tmpDir);
      sh("git", ["reset", "--hard", upstreamRef], tmpDir); // resets branchName in place — no re-checkout needed

      const result = fn(tmpDir);
      try {
        generateRoadmapMarkdown(tmpDir);
      } catch {
        // best-effort — same as the non-synced path in bin/scrummy.ts
      }

      sh("git", ["add", "-A"], tmpDir);
      if (sh("git", ["diff", "--cached", "--quiet"], tmpDir).status === 0) {
        return result; // nothing to land
      }

      // --no-verify: this commit only ever contains docs/roadmap/*+ROADMAP.md (the
      // `add -A` above runs in a worktree that only `fn`/regen ever touched), so a
      // source-build pre-commit hook has nothing relevant to verify, and its build
      // wouldn't even find node_modules reliably across every possible worktree setup.
      const committed = sh("git", ["commit", "--no-verify", "-m", `scrummy: ${commandLabel}`], tmpDir);
      if (committed.status !== 0) {
        lastError = committed.stderr.trim();
        continue;
      }

      const landed = land(tmpDir, branchName, target.branch, target.remote, commandLabel);
      if (landed.ok) {
        return result;
      }
      lastError = landed.error ?? "unknown error";
      // Retry from scratch: next loop's fetch+reset discards this attempt's commit
      // and re-runs `fn` against the state that actually won the race.
    }

    throw new GitSyncError(
      `Couldn't land "${commandLabel}" on ${upstreamRef} after ${MAX_ATTEMPTS} attempts: ${lastError}`,
    );
  } finally {
    sh("git", ["worktree", "remove", tmpDir, "--force"], originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    sh("git", ["branch", "-D", branchName], originalCwd); // best-effort — no-op if it landed (gh deleted it) or never existed
  }
}
