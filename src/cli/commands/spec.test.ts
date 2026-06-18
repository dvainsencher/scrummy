import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specFilePath } from "../../storage/paths.js";
import { addItem } from "./addItem.js";
import { init } from "./init.js";
import { spec } from "./spec.js";

describe("spec", () => {
  let cwd: string;
  let id: number;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
    id = addItem(cwd, "Dark mode");
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("creates the spec file with a minimal template if absent", () => {
    const returnedPath = spec(cwd, id);
    expect(returnedPath).toBe(specFilePath(cwd, id));
    expect(fs.readFileSync(returnedPath, "utf8")).toBe("# Dark mode\n");
  });

  it("returns the existing path without overwriting an existing spec", () => {
    spec(cwd, id);
    fs.writeFileSync(specFilePath(cwd, id), "custom content\n");
    spec(cwd, id);
    expect(fs.readFileSync(specFilePath(cwd, id), "utf8")).toBe("custom content\n");
  });

  it("throws for a nonexistent item", () => {
    expect(() => spec(cwd, 999)).toThrow(/999/);
  });
});
