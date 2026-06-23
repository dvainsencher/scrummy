import { existsSync, readdirSync, statSync } from "node:fs";
import {
  ISSUE_STATUSES,
  PROGRESS_ENTRY_TYPES,
  SPRINT_STATUSES,
  type Issue,
  type ProgressEntryType,
  type Sprint,
} from "./types.js";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function closestSprint(sprints: Sprint[], name: string): string | undefined {
  const lower = name.toLowerCase();
  // Substring match first (sprint names are long free-text — partial input is common)
  const substringMatch = sprints.find((s) => s.name.toLowerCase().includes(lower));
  if (substringMatch) return substringMatch.name;
  // Levenshtein fallback — only suggest when edit distance is small relative to name length
  let best: Sprint | undefined;
  let bestDist = Infinity;
  for (const sprint of sprints) {
    const dist = levenshtein(lower, sprint.name.toLowerCase());
    const threshold = Math.max(2, Math.floor(sprint.name.length * 0.2));
    if (dist < bestDist && dist <= threshold) {
      best = sprint;
      bestDist = dist;
    }
  }
  return best?.name;
}

export function assertSprintExists(sprints: Sprint[], name: string): void {
  if (!sprints.some((sprint) => sprint.name === name)) {
    const suggestion = closestSprint(sprints, name);
    const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
    throw new Error(`Sprint "${name}" does not exist.${hint}`);
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

export function assertProgressType(type: string): void {
  if (!PROGRESS_ENTRY_TYPES.includes(type as ProgressEntryType)) {
    throw new Error(
      `Invalid progress type "${type}" — must be one of: ${PROGRESS_ENTRY_TYPES.join(", ")}`,
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

const PAUTA_OWNED_ROADMAP_ENTRIES = new Set(["issues.jsonl", "sprints.json", "progress.jsonl", "specs"]);

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
