import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addItem } from "./addItem.js";
import { init } from "./init.js";
import { show } from "./show.js";

describe("show", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("renders pretty by default", () => {
    addItem(cwd, "Dark mode");
    const out = show(cwd, {});
    expect(out).toContain("BACKLOG (1)");
    expect(out).toContain("Dark mode");
  });

  it("renders json when json: true", () => {
    addItem(cwd, "Dark mode");
    const out = show(cwd, { json: true });
    const parsed = JSON.parse(out);
    expect(parsed.backlog[0].title).toBe("Dark mode");
  });

  it("passes through sprint and done options", () => {
    addItem(cwd, "Dark mode");
    expect(() => show(cwd, { sprint: "missing" })).toThrow(/missing/);
  });
});
