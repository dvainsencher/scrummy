import fs from "node:fs";
import { assertIssueExists } from "../../domain/validation.js";
import { specFilePath } from "../../storage/paths.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";

export function removeIssue(cwd: string, id: number): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);

  writeIssues(cwd, issues.filter((issue) => issue.id !== id));

  const specPath = specFilePath(cwd, id);
  if (fs.existsSync(specPath)) {
    fs.rmSync(specPath);
  }
  return `Removed issue #${id}`;
}
