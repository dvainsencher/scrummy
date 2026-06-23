import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isEntryPoint, main } from "./pauta.js";

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

describe("isEntryPoint", () => {
  const pautaPath = path.join(import.meta.dirname, "pauta.ts");
  const pautaUrl = pathToFileURL(pautaPath).href;

  it("returns true when argv[1] is the real path to the module", () => {
    expect(isEntryPoint(pautaPath, pautaUrl)).toBe(true);
  });

  it("resolves a symlinked argv[1] (e.g. node_modules/.bin/pauta) to the real module path", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-symlink-"));
    const symlinkPath = path.join(tmpDir, "pauta-bin");
    fs.symlinkSync(pautaPath, symlinkPath);

    expect(isEntryPoint(symlinkPath, pautaUrl)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false for an unrelated path", () => {
    expect(isEntryPoint("/some/unrelated/file.js", pautaUrl)).toBe(false);
  });

  it("returns false when argv[1] is undefined", () => {
    expect(isEntryPoint(undefined, pautaUrl)).toBe(false);
  });
});
