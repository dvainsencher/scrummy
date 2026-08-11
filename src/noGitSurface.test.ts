// Guard: scrummy must not shell out. Ever.
//
// PR #53 gave every mutating command a git surface — a disposable worktree, `git fetch`
// from origin, `gh pr create`, `gh pr merge --squash`. Consequences, both real:
//
//   1. It ran inside whatever project invoked scrummy. In easy-nf it opened and auto-merged
//      5 unreviewed PRs onto that project's production main (#318–323), bypassing its own
//      review pipeline entirely.
//   2. A sync worktree symlinked node_modules; `git add -A` committed the broken,
//      machine-specific symlink onto scrummy's own main (#52, cleaned up in #55).
//
// Both were reverted (#54, #55). Nothing scrummy needs requires a subprocess: concurrency
// safety is a lockfile (storage/lock.ts) and merge safety is the on-disk layout. Reaching
// for child_process again means reaching into a consuming project's repo, so it should be a
// deliberate, visible decision — this test is what makes it one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

function productionSourceFiles(): string[] {
  return fs
    .readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .map((entry) => path.join(srcDir, entry))
    .filter((file) => fs.statSync(file).isFile());
}

describe("no git surface", () => {
  it("finds production sources to check", () => {
    // Guards the guard: a broken walker would make every assertion below vacuously true.
    expect(productionSourceFiles().length).toBeGreaterThan(20);
  });

  it("never imports child_process from production code", () => {
    const offenders = productionSourceFiles().filter((file) =>
      /from\s+["'](node:)?child_process["']|require\(\s*["'](node:)?child_process["']\s*\)|import\(\s*["'](node:)?child_process["']\s*\)/.test(
        fs.readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((file) => path.relative(srcDir, file))).toEqual([]);
  });

  it("never invokes git or gh from production code", () => {
    const offenders = productionSourceFiles().filter((file) =>
      /\b(spawnSync|execSync|execFileSync|spawn|execFile)\s*\(\s*["'`](git|gh)\b/.test(
        fs.readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((file) => path.relative(srcDir, file))).toEqual([]);
  });
});
