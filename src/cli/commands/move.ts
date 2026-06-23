import { assertIssueExists, assertSprintExists } from "../../domain/validation.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints } from "../../storage/sprintsStore.js";

export function move(cwd: string, id: number, sprintName: string): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);
  assertSprintExists(readSprints(cwd), sprintName);

  writeMoved(cwd, issues, id, sprintName);
  return `Moved issue #${id} to sprint "${sprintName}"`;
}

export function moveToBacklog(cwd: string, id: number): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);

  writeMoved(cwd, issues, id, "");
  return `Moved issue #${id} to backlog`;
}

function writeMoved(
  cwd: string,
  issues: ReturnType<typeof readIssues>,
  id: number,
  sprint: string,
): void {
  const now = new Date().toISOString();
  const updated = issues.map((issue) =>
    issue.id === id ? { ...issue, sprint, updatedAt: now } : issue,
  );
  writeIssues(cwd, updated);
}
