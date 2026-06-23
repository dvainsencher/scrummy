import { assertIssueExists } from "../../domain/validation.js";
import type { ProgressEntry } from "../../domain/types.js";
import { readIssues } from "../../storage/issuesStore.js";
import { readProgress } from "../../storage/progressStore.js";

export function showLog(cwd: string, id: number): ProgressEntry[] {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);

  return readProgress(cwd)
    .filter((entry) => entry.issueId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
