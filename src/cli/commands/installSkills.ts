import fs from "node:fs";
import path from "node:path";
import { assertDirectoryExists } from "../../domain/validation.js";

export function installSkills(cwd: string, sourceDir: string): string[] {
  assertDirectoryExists(sourceDir, "Skills source directory");

  const targetRoot = path.join(cwd, ".claude", "skills");
  fs.mkdirSync(targetRoot, { recursive: true });

  const skillDirs = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const entry of skillDirs) {
    fs.cpSync(path.join(sourceDir, entry.name), path.join(targetRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }

  return skillDirs.map((entry) => entry.name);
}
