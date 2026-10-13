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
    spawnSync(tsx, [cli, "init"], { cwd });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("streams one NDJSON event per change made by another process", async () => {
    const child = spawn(tsx, [cli, "watch", "--json", "--interval", "50"], { cwd });
    const lines: string[] = [];
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      lines.push(...parts);
    });

    const waitFor = async (count: number) => {
      const deadline = Date.now() + 20_000;
      while (lines.length < count && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
    };

    try {
      // Give the watcher time to take its first snapshot before mutating.
      await new Promise((r) => setTimeout(r, 1500));
      spawnSync(tsx, [cli, "add-issue", "watched", "--status", "ready"], { cwd });
      await waitFor(1);
      spawnSync(tsx, [cli, "claim", "1", "--as", "alice"], { cwd });
      await waitFor(2);
    } finally {
      child.kill();
    }

    expect(lines.map((line) => JSON.parse(line).type)).toEqual(["issue.added", "claim.acquired"]);
    expect(JSON.parse(lines[1])).toMatchObject({ id: 1, assignee: "alice" });
  }, 60_000);

  it("rejects a nonsense --interval", () => {
    const result = spawnSync(tsx, [cli, "watch", "--interval", "abc"], { cwd, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--interval");
  });
});
