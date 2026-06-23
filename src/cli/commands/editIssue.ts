import type { IssueStatus } from "../../domain/types.js";
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
  const updated = issues.map((issue) =>
    issue.id === id
      ? {
          ...issue,
          title: options.title ?? issue.title,
          status: (options.status as IssueStatus | undefined) ?? issue.status,
          updatedAt: now,
        }
      : issue,
  );

  writeIssues(cwd, updated);
  return `Updated issue #${id}`;
}
