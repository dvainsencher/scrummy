// Where the roadmap lives for a given working directory.
//
// Every worktree of a project used to carry its own copy of docs/roadmap/, so agents in
// different worktrees allocated duplicate ids and never saw each other's changes. Resolving
// every worktree to one canonical checkout makes the lock, the ids and the files shared.
//
// Reading git's own metadata files (`.git`, `commondir`, `HEAD`) is plain file I/O, not a
// git subprocess, so the no-git-surface rule (noGitSurface.test.ts) still holds.
import fs from "node:fs";
import path from "node:path";

export type RootRule = "env" | "config" | "worktree" | "cwd";

export interface ResolvedRoot {
  root: string;
  rule: RootRule;
}

export interface RootConfig {
  roadmapRoot?: string;
  mainBranch?: string;
}

type Env = Record<string, string | undefined>;

const DEFAULT_MAIN_BRANCH = "main";

function readConfig(root: string): RootConfig {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(root, "docs", "roadmap", "config.json"), "utf8"),
    );
    return typeof parsed === "object" && parsed !== null ? (parsed as RootConfig) : {};
  } catch {
    return {};
  }
}

function readTrimmed(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return undefined;
  }
}

/**
 * The git admin dir for a checkout: `.git/` itself, or the target of a linked worktree's
 * `.git` file. Walks up so a root that is a subdirectory of a repo is still recognised.
 */
function gitDirOf(checkout: string): string | undefined {
  const parent = path.dirname(checkout);
  return gitDirIn(checkout) ?? (parent === checkout ? undefined : gitDirOf(parent));
}

function gitDirIn(checkout: string): string | undefined {
  const dotGit = path.join(checkout, ".git");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(dotGit);
  } catch {
    return undefined;
  }
  if (stat.isDirectory()) {
    return dotGit;
  }
  const match = /^gitdir:\s*(.+)$/m.exec(readTrimmed(dotGit) ?? "");
  return match ? path.resolve(checkout, match[1].trim()) : undefined;
}

/** For a linked worktree, the primary checkout it was created from. */
function primaryWorktreeOf(checkout: string): string | undefined {
  const dotGit = path.join(checkout, ".git");
  try {
    if (!fs.statSync(dotGit).isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  const gitDir = gitDirOf(checkout);
  const commonRel = gitDir && readTrimmed(path.join(gitDir, "commondir"));
  if (!gitDir || !commonRel) {
    return undefined;
  }
  const commonDir = path.resolve(gitDir, commonRel);
  // A bare repository's common dir isn't named `.git`; there is no primary checkout then.
  return path.basename(commonDir) === ".git" ? path.dirname(commonDir) : undefined;
}

export function resolveRoadmapRoot(cwd: string, env: Env = process.env): ResolvedRoot {
  if (env.SCRUMMY_ROOT) {
    return { root: path.resolve(cwd, env.SCRUMMY_ROOT), rule: "env" };
  }
  const configured = readConfig(cwd).roadmapRoot;
  if (configured) {
    return { root: path.resolve(cwd, configured), rule: "config" };
  }
  const primary = primaryWorktreeOf(cwd);
  // Before the roadmap has been merged to the primary checkout there is nothing to share,
  // so keep working on the worktree's own copy rather than failing.
  if (primary && fs.existsSync(path.join(primary, "docs", "roadmap"))) {
    return { root: primary, rule: "worktree" };
  }
  return { root: cwd, rule: "cwd" };
}

export interface GuardOptions {
  allowBranch?: boolean;
}

/**
 * Refuses a mutation when the canonical checkout is not on the main branch, so roadmap
 * files can't land on a feature branch by accident. Applies to every root, including a
 * plain checkout; `--allow-branch` / SCRUMMY_ALLOW_BRANCH=1 is the escape hatch.
 */
export function assertCanonicalBranch(
  resolved: ResolvedRoot,
  env: Env = process.env,
  options: GuardOptions = {},
): void {
  if (options.allowBranch || env.SCRUMMY_ALLOW_BRANCH === "1") {
    return;
  }
  const gitDir = gitDirOf(resolved.root);
  const head = gitDir && readTrimmed(path.join(gitDir, "HEAD"));
  if (!head) {
    return;
  }
  const mainBranch =
    readConfig(resolved.root).mainBranch ?? DEFAULT_MAIN_BRANCH;
  const match = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
  if (match?.[1] === mainBranch) {
    return;
  }
  const where = match ? `on branch "${match[1]}"` : "on a detached HEAD";
  throw new Error(
    `Refusing to modify the roadmap: the roadmap root ${resolved.root} is ${where}, ` +
      `not "${mainBranch}". Check out "${mainBranch}" there, or pass --allow-branch ` +
      `(or set SCRUMMY_ALLOW_BRANCH=1) to override.`,
  );
}

export function describeRoot(resolved: ResolvedRoot): string {
  const why: Record<RootRule, string> = {
    env: "SCRUMMY_ROOT environment variable",
    config: "roadmapRoot in docs/roadmap/config.json",
    worktree: "cwd is a linked git worktree; using its primary checkout",
    cwd: "current directory (no override, not a linked worktree)",
  };
  return `${resolved.root}\n(${why[resolved.rule]})`;
}
