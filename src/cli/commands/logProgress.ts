import { assertIssueExists, assertProgressType } from "../../domain/validation.js";
import { readIssues } from "../../storage/issuesStore.js";
import { appendProgress } from "../../storage/progressStore.js";
import type { ProgressEntryType } from "../../domain/types.js";

export function logProgress(cwd: string, id: number, type: string, message: string): void {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);
  assertProgressType(type);

  appendProgress(cwd, {
    issueId: id,
    type: type as ProgressEntryType,
    message,
    createdAt: new Date().toISOString(),
  });
}
