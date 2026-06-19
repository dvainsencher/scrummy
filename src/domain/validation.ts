import { statSync } from "node:fs";
import { ISSUE_STATUSES, SPRINT_STATUSES, type Issue, type Sprint } from "./types.js";

export function assertSprintExists(sprints: Sprint[], name: string): void {
  if (!sprints.some((sprint) => sprint.name === name)) {
    throw new Error(`Sprint "${name}" does not exist`);
  }
}

export function assertIssueExists(issues: Issue[], id: number): void {
  if (!issues.some((issue) => issue.id === id)) {
    throw new Error(`Issue #${id} does not exist`);
  }
}

export function assertSprintNameAvailable(sprints: Sprint[], name: string): void {
  if (sprints.some((sprint) => sprint.name === name)) {
    throw new Error(`Sprint "${name}" already exists`);
  }
}

export function assertIssueStatus(status: string): void {
  if (!ISSUE_STATUSES.includes(status as Issue["status"])) {
    throw new Error(
      `Invalid issue status "${status}" — must be one of: ${ISSUE_STATUSES.join(", ")}`,
    );
  }
}

export function assertSprintStatus(status: string): void {
  if (!SPRINT_STATUSES.includes(status as Sprint["status"])) {
    throw new Error(
      `Invalid sprint status "${status}" — must be one of: ${SPRINT_STATUSES.join(", ")}`,
    );
  }
}

export function assertDirectoryExists(dirPath: string, label: string): void {
  let stats;
  try {
    stats = statSync(dirPath);
  } catch {
    throw new Error(`${label} "${dirPath}" does not exist`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${label} "${dirPath}" is not a directory`);
  }
}
