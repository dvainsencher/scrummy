import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "./pauta.js";

describe("main", () => {
  let cwd: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    stdout = [];
    stderr = [];
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  function run(argv: string[]) {
    return main({
      argv,
      cwd,
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });
  }

  it("prints usage and exits 0 on bare invocation", () => {
    const exitCode = run([]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Usage: pauta <command> [args]");
  });

  it("prints usage and exits 0 on --help", () => {
    const exitCode = run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Usage: pauta <command> [args]");
  });

  it("prints usage and exits 0 on -h", () => {
    const exitCode = run(["-h"]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Usage: pauta <command> [args]");
  });

  it("prints an unknown-command error with a hint and exits 1", () => {
    const exitCode = run(["bogus"]);
    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("Unknown command: bogus");
    expect(stderr.join("")).toContain('Run "pauta --help"');
  });

  it("dispatches a known command and prints its result", () => {
    const exitCode = run(["init"]);
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Initialized docs/roadmap/");
  });

  it("prints the error message and exits 1 when a handler throws", () => {
    const exitCode = run(["edit-issue", "999", "--title", "x"]);
    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("999");
  });
});
