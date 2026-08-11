import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sprint } from "../domain/types.js";
import { legacySprintsFilePath, roadmapDir, sprintsDir } from "./paths.js";
import { readSprints, writeSprints } from "./sprintsStore.js";

describe("sprintsStore", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-test-"));
    fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  const sample: Sprint = {
    name: "foundation",
    position: 10,
    goal: "build the mechanical layer",
    notes: "",
  };

  it("reads a missing store as an empty array", () => {
    expect(readSprints(cwd)).toEqual([]);
  });

  it("round-trips sprints through write then read", () => {
    writeSprints(cwd, [sample]);
    expect(readSprints(cwd)).toEqual([sample]);
  });

  it("stores one pretty-printed file per sprint, named by slug", () => {
    const other: Sprint = { ...sample, name: "Terminal Kanban Viewer", position: 20 };
    writeSprints(cwd, [sample, other]);
    expect(fs.readdirSync(sprintsDir(cwd)).sort()).toEqual([
      "foundation.json",
      "terminal-kanban-viewer.json",
    ]);
    const raw = fs.readFileSync(path.join(sprintsDir(cwd), "foundation.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(sample);
  });

  it("writes an empty set as an empty directory", () => {
    writeSprints(cwd, []);
    expect(readSprints(cwd)).toEqual([]);
    expect(fs.readdirSync(sprintsDir(cwd))).toEqual([]);
  });

  it("returns sprints ordered by position, then name", () => {
    writeSprints(cwd, [
      { ...sample, name: "third", position: 30 },
      { ...sample, name: "beta", position: 10 },
      { ...sample, name: "alpha", position: 10 },
    ]);
    expect(readSprints(cwd).map((sprint) => sprint.name)).toEqual(["alpha", "beta", "third"]);
  });

  it("keeps names that slugify identically in separate files", () => {
    writeSprints(cwd, [
      { ...sample, name: "A B" },
      { ...sample, name: "A-B", position: 20 },
    ]);
    expect(fs.readdirSync(sprintsDir(cwd))).toHaveLength(2);
    expect(readSprints(cwd).map((sprint) => sprint.name).sort()).toEqual(["A B", "A-B"]);
  });

  // A sprint's filename must depend only on the set of names, never on their order —
  // otherwise reordering would rewrite unrelated files and churn every diff.
  it("names files independently of the order sprints are written in", () => {
    const a: Sprint = { ...sample, name: "A B" };
    const b: Sprint = { ...sample, name: "A-B", position: 20 };
    writeSprints(cwd, [a, b]);
    const forward = fs.readdirSync(sprintsDir(cwd)).sort();

    fs.rmSync(sprintsDir(cwd), { recursive: true, force: true });
    writeSprints(cwd, [b, a]);
    expect(fs.readdirSync(sprintsDir(cwd)).sort()).toEqual(forward);
  });

  it("leaves untouched sprints byte-identical when another sprint changes", () => {
    const other: Sprint = { ...sample, name: "later", position: 20 };
    writeSprints(cwd, [sample, other]);
    const untouched = path.join(sprintsDir(cwd), "foundation.json");
    const before = fs.statSync(untouched).mtimeMs;

    writeSprints(cwd, [sample, { ...other, goal: "changed" }]);

    expect(fs.statSync(untouched).mtimeMs).toBe(before);
  });

  it("removes the file for a sprint that is no longer present", () => {
    writeSprints(cwd, [sample, { ...sample, name: "later", position: 20 }]);
    writeSprints(cwd, [sample]);
    expect(fs.readdirSync(sprintsDir(cwd))).toEqual(["foundation.json"]);
  });

  it("strips a legacy stored `status` field on read (status is derived, never stored)", () => {
    fs.mkdirSync(sprintsDir(cwd), { recursive: true });
    fs.writeFileSync(
      path.join(sprintsDir(cwd), "foundation.json"),
      `${JSON.stringify({ ...sample, status: "active" }, null, 2)}\n`,
    );
    expect(readSprints(cwd)).toEqual([sample]);
    expect(readSprints(cwd)[0]).not.toHaveProperty("status");
  });

  describe("migration from the pre-directory layout", () => {
    it("reads the legacy sprints.json when no sprints directory exists", () => {
      fs.writeFileSync(legacySprintsFilePath(cwd), `${JSON.stringify([sample], null, 2)}\n`);
      expect(readSprints(cwd)).toEqual([sample]);
    });

    it("strips a legacy stored `status` field from the legacy file too", () => {
      fs.writeFileSync(
        legacySprintsFilePath(cwd),
        `${JSON.stringify([{ ...sample, status: "active" }], null, 2)}\n`,
      );
      expect(readSprints(cwd)[0]).not.toHaveProperty("status");
    });

    it("migrates on first write, losing nothing and removing the legacy file", () => {
      fs.writeFileSync(legacySprintsFilePath(cwd), `${JSON.stringify([sample], null, 2)}\n`);
      const added: Sprint = { ...sample, name: "next", position: 20 };

      writeSprints(cwd, [...readSprints(cwd), added]);

      expect(fs.existsSync(legacySprintsFilePath(cwd))).toBe(false);
      expect(fs.readdirSync(sprintsDir(cwd)).sort()).toEqual(["foundation.json", "next.json"]);
      expect(readSprints(cwd)).toEqual([sample, added]);
    });

    // See issuesStore.test.ts: the legacy file's deletion is the migration's commit point,
    // so a possibly-partial directory never outranks it.
    it("treats the legacy file as authoritative until it is deleted", () => {
      const other: Sprint = { ...sample, name: "second", position: 20 };
      fs.writeFileSync(legacySprintsFilePath(cwd), `${JSON.stringify([sample, other], null, 2)}\n`);
      fs.mkdirSync(sprintsDir(cwd), { recursive: true });
      fs.writeFileSync(
        path.join(sprintsDir(cwd), "foundation.json"),
        `${JSON.stringify(sample, null, 2)}\n`,
      );

      expect(readSprints(cwd)).toEqual([sample, other]);
    });
  });

  // Two sprints sharing a name map to one filename, so a Map keyed on it would silently
  // drop one. Before the per-file layout duplicates survived a write — confusing but
  // lossless — so collapsing them here would turn a recoverable merge anomaly into
  // permanent deletion.
  it("refuses to write duplicate sprint names rather than silently dropping one", () => {
    expect(() => writeSprints(cwd, [sample, { ...sample, goal: "collides" }])).toThrow(
      /foundation/,
    );
  });
});
