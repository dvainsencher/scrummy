import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packageRoot, skillsSourceDir } from "./packageRoot.js";

describe("package.json integrity", () => {
  it("does not contain a self-referencing devDependency (circular symlink guard)", () => {
    const pkgPath = path.join(packageRoot(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const devDeps: Record<string, string> = pkg.devDependencies ?? {};
    const selfRef = Object.entries(devDeps).find(
      ([name, version]) => name === pkg.name && version === "file:."
    );
    expect(selfRef).toBeUndefined();
  });
});

describe("packageRoot", () => {
  it("resolves to the directory containing package.json", () => {
    expect(fs.existsSync(path.join(packageRoot(), "package.json"))).toBe(true);
  });
});

describe("skillsSourceDir", () => {
  it("resolves to the package's skills/ directory", () => {
    expect(skillsSourceDir()).toBe(path.join(packageRoot(), "skills"));
  });

  it("points at a directory that actually contains the shipped skills", () => {
    expect(fs.existsSync(path.join(skillsSourceDir(), "scrummy-add-issue", "SKILL.md"))).toBe(true);
  });
});
