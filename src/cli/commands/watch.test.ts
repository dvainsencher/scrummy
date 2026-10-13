import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");
const cli = path.join(repoRoot, "src", "bin", "scrummy.ts");

describe("scrummy watch --json", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-watchcli-"));
    expect(spawnSync(tsx, [cli, "init"], { cwd }).status).toBe(0);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("streams one NDJSON event per change made by another process", async () => {
    const child = spawn(tsx, [cli, "watch", "--json", "--interval", "50"], { cwd });
    const lines: string[] = [];
    let buffer = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      lines.push(...parts);
    });
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));

    const until = async (what: string, done: () => boolean) => {
      const deadline = Date.now() + 20_000;
      while (!done()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise((r) => setTimeout(r, 25));
      }
    };
    const run = (...argv: string[]) => expect(spawnSync(tsx, [cli, ...argv], { cwd }).status).toBe(0);

    try {
      // `Watching` is printed once the baseline snapshot exists; mutating earlier would race it.
      await until("the watcher to be ready", () => stderr.includes("Watching"));
      run("add-issue", "watched", "--status", "ready");
      await until("issue.added", () => lines.length >= 1);
      run("claim", "1", "--as", "alice");
      await until("claim.acquired", () => lines.length >= 2);
    } finally {
      child.kill();
    }

    expect(lines.map((line) => JSON.parse(line).type)).toEqual(["issue.added", "claim.acquired"]);
    expect(JSON.parse(lines[1])).toMatchObject({ id: 1, assignee: "alice" });
  }, 60_000);

  it("exits on its own when the reader of its stdout goes away", async () => {
    const child = spawn(tsx, [cli, "watch", "--json", "--interval", "50"], { cwd });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
    try {
      const deadline = Date.now() + 20_000;
      while (!stderr.includes("Watching")) {
        if (Date.now() > deadline) throw new Error("watcher never became ready");
        await new Promise((r) => setTimeout(r, 25));
      }
      child.stdout.destroy(); // the reader hangs up
      expect(spawnSync(tsx, [cli, "add-issue", "wake it"], { cwd }).status).toBe(0);
      const code = await Promise.race([
        exited,
        new Promise<string>((r) => setTimeout(() => r("still running"), 15_000)),
      ]);
      expect(code).not.toBe("still running");
    } finally {
      child.kill();
    }
  }, 60_000);

  it("rejects a nonsense --interval", () => {
    const result = spawnSync(tsx, [cli, "watch", "--interval", "abc"], { cwd, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--interval");
  });
});
