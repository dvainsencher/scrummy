import type { IssueStatus } from "../../domain/types.js";
import { withoutClaim } from "../../domain/claims.js";
import { assertIssueExists, assertIssueStatus } from "../../domain/validation.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";

export interface EditIssueOptions {
  title?: string;
  status?: string;
}

export function editIssue(cwd: string, id: number, options: EditIssueOptions): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);
  if (options.status !== undefined) {
    assertIssueStatus(options.status);
  }

  const now = new Date().toISOString();
  const updated = issues.map((issue) => {
    if (issue.id !== id) {
      return issue;
    }
    const status = (options.status as IssueStatus | undefined) ?? issue.status;
    const edited = { ...issue, title: options.title ?? issue.title, status, updatedAt: now };
    // A claim only makes sense while the issue is being worked on.
    return status === "doing" ? edited : withoutClaim(edited);
  });

  writeIssues(cwd, updated);
  return `Updated issue #${id}`;
}
