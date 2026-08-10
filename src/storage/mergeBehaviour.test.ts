// Real-git merge behaviour. No mocks: these run actual `git merge` against actual commits,
// because the entire reason docs/roadmap/ is a directory of files rather than a JSONL file
// is what git's three-way merge does with it.
//
// Under the old single-file layout, git could not distinguish "two people edited different
// records" from "two people edited the same one" — every record change was an adjacent-line
// change. Two `add-issue` calls that allocated *different* ids conflicted. So did an
// `add-issue` alongside a `set-status` on the last issue. Those false conflicts are what a
// user hits every time a feature branch merges, and they are what this layout removes.
//
// What must still conflict: genuine collisions. Those are worth stopping for.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../bin/scrummy.js";

function git(cwd: string, args: string[]): { status: number; stdout: string } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

function gitOrThrow(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

function scrummy(cwd: string, argv: string[]): void {
  const errors: string[] = [];
  const code = main({ argv, cwd, stdout: () => {}, stderr: (text) => errors.push(text) });
  if (code !== 0) {
    throw new Error(`scrummy ${argv.join(" ")} failed: ${errors.join("")}`);
  }
}

interface MergeOutcome {
  clean: boolean;
  /** Paths git could not merge, e.g. ["docs/roadmap/issues/3.json"]. */
  conflicted: string[];
}

/**
 * Apply `base`, branch, apply `ours` and `theirs` independently, then merge them.
 * Each element is one scrummy command line.
 */
function mergeAfter(base: string[][], ours: string[][], theirs: string[][]): MergeOutcome {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-merge-"));
  try {
    gitOrThrow(cwd, ["init", "-b", "main", "."]);
    gitOrThrow(cwd, ["config", "user.email", "test@example.com"]);
    gitOrThrow(cwd, ["config", "user.name", "Test"]);

    scrummy(cwd, ["init"]);
    for (const argv of base) {
      scrummy(cwd, argv);
    }
    gitOrThrow(cwd, ["add", "-A"]);
    gitOrThrow(cwd, ["commit", "-q", "-m", "base"]);

    gitOrThrow(cwd, ["checkout", "-q", "-b", "theirs"]);
    for (const argv of theirs) {
      scrummy(cwd, argv);
    }
    gitOrThrow(cwd, ["add", "-A"]);
    gitOrThrow(cwd, ["commit", "-q", "-m", "theirs"]);

    gitOrThrow(cwd, ["checkout", "-q", "main"]);
    for (const argv of ours) {
      scrummy(cwd, argv);
    }
    gitOrThrow(cwd, ["add", "-A"]);
    gitOrThrow(cwd, ["commit", "-q", "-m", "ours"]);

    const merge = git(cwd, ["merge", "--squash", "theirs"]);
    const conflicted = git(cwd, ["diff", "--name-only", "--diff-filter=U"])
      .stdout.split("\n")
      .filter((line) => line.trim().length > 0);
    return { clean: merge.status === 0, conflicted };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

/** Conflicts in the generated ROADMAP.md are expected and separately covered below. */
function roadmapDataConflicts(outcome: MergeOutcome): string[] {
  return outcome.conflicted.filter((file) => file.startsWith("docs/roadmap/"));
}

const SEED = [
  ["add-issue", "first"],
  ["add-issue", "second"],
  ["add-issue", "third"],
];

describe("merge behaviour of the roadmap layout", () => {
  describe("independent changes merge cleanly", () => {
    it("add-issue on one side, set-status on the LAST issue on the other", () => {
      const outcome = mergeAfter(SEED, [["add-issue", "fourth"]], [["set-status", "3", "done"]]);
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("remove-issue on one side, add-issue on the other", () => {
      const outcome = mergeAfter(SEED, [["remove-issue", "1"]], [["add-issue", "fourth"]]);
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("move an issue into a sprint on one side, edit a different issue on the other", () => {
      const outcome = mergeAfter(
        [...SEED, ["create-sprint", "target", "--goal", "g"]],
        [["move", "1", "target"]],
        [["edit-issue", "2", "--title", "renamed"]],
      );
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("set-status on different issues", () => {
      const outcome = mergeAfter(SEED, [["set-status", "1", "done"]], [["set-status", "2", "done"]]);
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("two create-sprint calls", () => {
      const outcome = mergeAfter(
        [],
        [["create-sprint", "alpha", "--goal", "a"]],
        [["create-sprint", "beta", "--goal", "b"]],
      );
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("create-sprint on one side, edit-sprint on the other", () => {
      const outcome = mergeAfter(
        [["create-sprint", "existing", "--goal", "g"]],
        [["create-sprint", "added", "--goal", "a"]],
        [["edit-sprint", "existing", "--goal", "changed"]],
      );
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("a realistic feature branch against a main that moved on", () => {
      const outcome = mergeAfter(
        SEED,
        [["set-status", "1", "done"], ["set-status", "2", "done"]],
        [["add-issue", "filed while the branch was open"], ["set-status", "3", "doing"]],
      );
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });

    it("progress logged on both sides", () => {
      const outcome = mergeAfter(
        SEED,
        [["log-issue", "1", "--type", "plan", "ours"]],
        [["log-issue", "1", "--type", "plan", "theirs"]],
      );
      expect(roadmapDataConflicts(outcome)).toEqual([]);
    });
  });

  describe("genuine collisions still conflict", () => {
    it("both sides add an issue that claims the same id", () => {
      const outcome = mergeAfter(SEED, [["add-issue", "ours"]], [["add-issue", "theirs"]]);
      expect(outcome.clean).toBe(false);
      expect(roadmapDataConflicts(outcome)).toEqual(["docs/roadmap/issues/4.json"]);
    });

    it("both sides edit the same issue differently", () => {
      const outcome = mergeAfter(
        SEED,
        [["set-status", "2", "done"]],
        [["edit-issue", "2", "--title", "renamed"]],
      );
      expect(outcome.clean).toBe(false);
      expect(roadmapDataConflicts(outcome)).toEqual(["docs/roadmap/issues/2.json"]);
    });

    it("both sides create a sprint with the same name", () => {
      const outcome = mergeAfter(
        [],
        [["create-sprint", "shared", "--goal", "ours"]],
        [["create-sprint", "shared", "--goal", "theirs"]],
      );
      expect(outcome.clean).toBe(false);
      expect(roadmapDataConflicts(outcome)).toEqual(["docs/roadmap/sprints/shared.json"]);
    });
  });

  // ROADMAP.md is a generated projection of the whole backlog, so it is a second file both
  // sides touch. It usually merges cleanly too — it is line-oriented markdown, so unrelated
  // records sit on unrelated lines — but two mutations landing on adjacent lines can still
  // conflict there even when the data underneath is fine. It is a derived file, so the fix
  // is never manual: resolve the data, then regenerate.
  it("merges cleanly end to end, generated ROADMAP.md included", () => {
    const outcome = mergeAfter(SEED, [["add-issue", "ours"]], [["set-status", "1", "done"]]);
    expect(outcome.conflicted).toEqual([]);
    expect(outcome.clean).toBe(true);
  });

  it("regenerates ROADMAP.md from the merged data, so a conflict there is never resolved by hand", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-regen-"));
    try {
      scrummy(cwd, ["init"]);
      scrummy(cwd, ["add-issue", "kept"]);
      // Whatever a conflicted merge left behind, including conflict markers.
      fs.writeFileSync(path.join(cwd, "ROADMAP.md"), "<<<<<<< ours\ngarbage\n=======\nmore\n>>>>>>> theirs\n");

      scrummy(cwd, ["roadmap"]);

      const regenerated = fs.readFileSync(path.join(cwd, "ROADMAP.md"), "utf8");
      expect(regenerated).not.toContain("<<<<<<<");
      expect(regenerated).toContain("kept");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
