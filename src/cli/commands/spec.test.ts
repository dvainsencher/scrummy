import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specFilePath } from "../../storage/paths.js";
import { addIssue } from "./addIssue.js";
import { init } from "./init.js";
import { spec } from "./spec.js";

describe("spec", () => {
  let cwd: string;
  let id: number;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    id = addIssue(cwd, "Dark mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("creates the spec file with a fixed-section skeleton if absent", () => {
    const returnedPath = spec(cwd, id);
    expect(returnedPath).toBe(specFilePath(cwd, id));
    expect(fs.readFileSync(returnedPath, "utf8")).toBe(
      "# Dark mode\n\n## Problem\n\n## Approach\n\n## Acceptance criteria\n\n## Open questions\n",
    );
  });

  it("returns the existing path without overwriting an existing spec", () => {
    spec(cwd, id);
    fs.writeFileSync(specFilePath(cwd, id), "custom content\n");
    spec(cwd, id);
    expect(fs.readFileSync(specFilePath(cwd, id), "utf8")).toBe("custom content\n");
  });

  it("throws for a nonexistent issue", () => {
    expect(() => spec(cwd, 999)).toThrow(/999/);
  });
});
