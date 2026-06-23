import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { skillsSourceDir } from "../../packageRoot.js";
import { installSkills } from "./installSkills.js";

describe("installSkills", () => {
  let cwd: string;
  let sourceDir: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-cwd-"));
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-skills-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  function writeSkill(name: string, content: string): void {
    const dir = path.join(sourceDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), content);
  }

  it("copies a skill directory into .claude/skills/<name>", () => {
    writeSkill("pauta-add-issue", "# add issue\n");
    installSkills(cwd, sourceDir);
    const installed = fs.readFileSync(
      path.join(cwd, ".claude", "skills", "pauta-add-issue", "SKILL.md"),
      "utf8",
    );
    expect(installed).toBe("# add issue\n");
  });

  it("copies every skill subdirectory", () => {
    writeSkill("pauta-add-issue", "# a\n");
    writeSkill("pauta-reorganize", "# b\n");
    installSkills(cwd, sourceDir);
    expect(fs.readdirSync(path.join(cwd, ".claude", "skills")).sort()).toEqual([
      "pauta-add-issue",
      "pauta-reorganize",
    ]);
  });

  it("returns the names of the skills installed", () => {
    writeSkill("pauta-add-issue", "# a\n");
    writeSkill("pauta-reorganize", "# b\n");
    expect(installSkills(cwd, sourceDir).sort()).toEqual(["pauta-add-issue", "pauta-reorganize"]);
  });

  it("overwrites stale content from a previous install", () => {
    writeSkill("pauta-add-issue", "# old\n");
    installSkills(cwd, sourceDir);
    fs.writeFileSync(path.join(sourceDir, "pauta-add-issue", "SKILL.md"), "# new\n");
    installSkills(cwd, sourceDir);
    const installed = fs.readFileSync(
      path.join(cwd, ".claude", "skills", "pauta-add-issue", "SKILL.md"),
      "utf8",
    );
    expect(installed).toBe("# new\n");
  });

  it("creates .claude/skills even if .claude doesn't exist yet", () => {
    writeSkill("pauta-add-issue", "# a\n");
    installSkills(cwd, sourceDir);
    expect(fs.statSync(path.join(cwd, ".claude", "skills")).isDirectory()).toBe(true);
  });

  it("throws a friendly error when the source skills directory is missing", () => {
    const missingDir = path.join(sourceDir, "does-not-exist");
    expect(() => installSkills(cwd, missingDir)).toThrow(
      `Skills source directory "${missingDir}" does not exist`,
    );
  });
});

describe("skill source files", () => {
  it("every SKILL.md uses npx pauta <cmd>, not bare pauta <cmd>", () => {
    const src = skillsSourceDir();
    const skillDirs = fs.readdirSync(src);
    const violations: string[] = [];
    for (const dir of skillDirs) {
      const skillFile = path.join(src, dir, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      const content = fs.readFileSync(skillFile, "utf8");
      // Match backtick-invocations of pauta commands (not skill names like `pauta-add-issue`)
      const bareInvocations = content.match(/`pauta [a-z]/g);
      if (bareInvocations) {
        violations.push(`${dir}/SKILL.md: ${bareInvocations.join(", ")}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
