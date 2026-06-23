import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Issue, Sprint } from "./types.js";
import {
  assertDirectoryExists,
  assertIssueExists,
  assertIssueStatus,
  assertRoadmapDirNotForeign,
  assertSprintExists,
  assertSprintNameAvailable,
  assertSprintStatus,
} from "./validation.js";

function sprint(name: string): Sprint {
  return { name, position: 10, status: "planned", goal: "", notes: "" };
}

function issue(id: number): Issue {
  return {
    id,
    title: "x",
    status: "idea",
    sprint: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("assertSprintExists", () => {
  it("does not throw when the sprint exists", () => {
    expect(() => assertSprintExists([sprint("foundation")], "foundation")).not.toThrow();
  });

  it("throws when the sprint does not exist", () => {
    expect(() => assertSprintExists([sprint("foundation")], "missing")).toThrow(/missing/);
  });

  it("appends a Did you mean suggestion when a close match exists (substring)", () => {
    expect(() => assertSprintExists([sprint("auth-hardening")], "auth")).toThrow(/Did you mean "auth-hardening"/);
  });

  it("appends a Did you mean suggestion when a close match exists (edit distance)", () => {
    expect(() =>
      assertSprintExists([sprint("onboarding-polish")], "onboarding-polsh"),
    ).toThrow(/Did you mean "onboarding-polish"/);
  });

  it("does not append Did you mean when no close match exists", () => {
    expect(() => assertSprintExists([sprint("auth-hardening")], "xyz")).toThrow("xyz");
    let message = "";
    try {
      assertSprintExists([sprint("auth-hardening")], "xyz");
    } catch (e) {
      message = e instanceof Error ? e.message : "";
    }
    expect(message).not.toContain("Did you mean");
  });

  it("picks the best match among multiple sprints", () => {
    const sprints = [sprint("auth-hardening"), sprint("onboarding-polish"), sprint("export-flow")];
    expect(() => assertSprintExists(sprints, "onboarding-polsh")).toThrow(
      /Did you mean "onboarding-polish"/,
    );
    expect(() => assertSprintExists(sprints, "onboarding-polsh")).not.toThrow(
      /Did you mean "auth-hardening"/,
    );
  });
});

describe("assertSprintNameAvailable", () => {
  it("does not throw for a new name", () => {
    expect(() => assertSprintNameAvailable([sprint("foundation")], "the-reader")).not.toThrow();
  });

  it("throws when the name is already taken", () => {
    expect(() => assertSprintNameAvailable([sprint("foundation")], "foundation")).toThrow(
      /foundation/,
    );
  });
});

describe("assertIssueExists", () => {
  it("does not throw when the issue exists", () => {
    expect(() => assertIssueExists([issue(1)], 1)).not.toThrow();
  });

  it("throws when the issue does not exist", () => {
    expect(() => assertIssueExists([issue(1)], 999)).toThrow(/999/);
  });
});

describe("assertIssueStatus", () => {
  it("does not throw for a valid status", () => {
    expect(() => assertIssueStatus("doing")).not.toThrow();
  });

  it("throws for an invalid status", () => {
    expect(() => assertIssueStatus("bogus")).toThrow(/bogus/);
  });
});

describe("assertSprintStatus", () => {
  it("does not throw for a valid status", () => {
    expect(() => assertSprintStatus("active")).not.toThrow();
  });

  it("throws for an invalid status", () => {
    expect(() => assertSprintStatus("bogus")).toThrow(/bogus/);
  });
});

describe("assertDirectoryExists", () => {
  it("does not throw for an existing directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-dir-"));
    try {
      expect(() => assertDirectoryExists(dir, "Some directory")).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when the path does not exist", () => {
    expect(() => assertDirectoryExists("/does/not/exist", "Some directory")).toThrow(
      /Some directory.*does not exist/,
    );
  });

  it("throws when the path is not a directory", () => {
    const file = path.join(os.tmpdir(), `pauta-test-file-${Date.now()}`);
    fs.writeFileSync(file, "x");
    try {
      expect(() => assertDirectoryExists(file, "Some directory")).toThrow(
        /Some directory.*is not a directory/,
      );
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
});

describe("assertRoadmapDirNotForeign", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-roadmap-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not throw when the directory does not exist yet", () => {
    const roadmapDir = path.join(dir, "docs", "roadmap");
    expect(() => assertRoadmapDirNotForeign(roadmapDir)).not.toThrow();
  });

  it("does not throw when the directory is empty", () => {
    expect(() => assertRoadmapDirNotForeign(dir)).not.toThrow();
  });

  it("does not throw when only pauta-owned entries exist (issues.jsonl, sprints.json, specs)", () => {
    fs.writeFileSync(path.join(dir, "issues.jsonl"), "");
    fs.writeFileSync(path.join(dir, "sprints.json"), "[]\n");
    fs.mkdirSync(path.join(dir, "specs"));
    expect(() => assertRoadmapDirNotForeign(dir)).not.toThrow();
  });

  it("does not throw when only a partial pauta init left specs/ behind (no issues.jsonl yet)", () => {
    fs.mkdirSync(path.join(dir, "specs"));
    expect(() => assertRoadmapDirNotForeign(dir)).not.toThrow();
  });

  it("throws when the directory has foreign content", () => {
    fs.writeFileSync(path.join(dir, "ROADMAP.md"), "# legacy backlog\n");
    expect(() => assertRoadmapDirNotForeign(dir)).toThrow(/docs\/roadmap-legacy/);
  });
});
