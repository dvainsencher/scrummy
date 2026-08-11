// Real multi-process concurrency tests. These deliberately spawn actual OS processes
// rather than calling main() in-process, because the bug they exist to catch is a
// lost update across processes: every mutating command does read → modify → write-whole-file
// (see issuesStore.writeIssues), so two overlapping writers silently discard one mutation.
// An in-process test cannot exhibit that, and a mocked filesystem would hide it.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "./issuesStore.js";
import { readSprints } from "./sprintsStore.js";
import { main } from "../bin/scrummy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");
const workerPath = path.join(here, "raceWorker.ts");

/**
 * Boot `count` worker processes, wait until every one reports it is loaded, then release
 * them all at once by creating the barrier file. Resolves with each worker's exit code.
 */
async function runConcurrently(cwd: string, count: number, argvFor: (i: number) => string[]): Promise<number[]> {
  const barrierPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-barrier-")), "go");
  const barrierDir = path.dirname(barrierPath);

  const exits = Array.from({ length: count }, (_, i) => {
    const child = spawn(tsx, [workerPath, cwd, barrierPath, ...argvFor(i)], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    return new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code !== 0 && stderr !== "") {
          process.stderr.write(`worker exited ${code}: ${stderr}`);
        }
        resolve(code ?? 1);
      });
    });
  });

  const deadline = Date.now() + 60_000;
  while (fs.readdirSync(barrierDir).filter((f) => f.startsWith("go.ready.")).length < count) {
    if (Date.now() > deadline) {
      throw new Error("workers never reported ready");
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  fs.writeFileSync(barrierPath, "");

  try {
    return await Promise.all(exits);
  } finally {
    fs.rmSync(barrierDir, { recursive: true, force: true });
  }
}

describe("concurrent mutating commands", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-race-"));
    main({ argv: ["init"], cwd, stdout: () => {}, stderr: () => {} });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("keeps every issue when many add-issue processes race", async () => {
    const count = 20;
    const exits = await runConcurrently(cwd, count, (i) => ["add-issue", `race issue ${i}`]);
    expect(exits).toEqual(Array(count).fill(0));

    const issues = readIssues(cwd);
    // Nothing may be silently dropped, and no id may be handed out twice.
    expect(issues).toHaveLength(count);
    expect(new Set(issues.map((issue) => issue.id)).size).toBe(count);
    expect(new Set(issues.map((issue) => issue.title)).size).toBe(count);
  }, 120_000);

  it("keeps every sprint when many create-sprint processes race", async () => {
    const count = 12;
    const exits = await runConcurrently(cwd, count, (i) => ["create-sprint", `race-sprint-${i}`]);
    expect(exits).toEqual(Array(count).fill(0));

    const sprints = readSprints(cwd);
    expect(sprints).toHaveLength(count);
    expect(new Set(sprints.map((sprint) => sprint.name)).size).toBe(count);
  }, 120_000);
});
