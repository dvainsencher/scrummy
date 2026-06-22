import { existsSync, readdirSync, statSync } from "node:fs";
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

export function assertSprintEmpty(issues: Issue[], name: string): void {
  if (issues.some((issue) => issue.sprint === name)) {
    throw new Error(`Sprint "${name}" still has issues assigned — move them out first`);
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

const PAUTA_OWNED_ROADMAP_ENTRIES = new Set(["issues.jsonl", "sprints.json", "specs"]);

export function assertRoadmapDirNotForeign(roadmapDir: string): void {
  if (!existsSync(roadmapDir)) {
    return;
  }
  const foreignEntries = readdirSync(roadmapDir).filter(
    (entry) => !entry.startsWith(".") && !PAUTA_OWNED_ROADMAP_ENTRIES.has(entry),
  );
  if (foreignEntries.length > 0) {
    throw new Error(
      `"${roadmapDir}" already exists and contains non-pauta content (${foreignEntries.join(", ")}). ` +
        `Move it out of the way first, e.g. "git mv docs/roadmap docs/roadmap-legacy", then run init again.`,
    );
  }
}
