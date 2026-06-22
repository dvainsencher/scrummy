import fs from "node:fs";
import type { Issue, IssueStatus } from "../../domain/types.js";
import { assertIssueStatus, assertSprintExists } from "../../domain/validation.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints } from "../../storage/sprintsStore.js";

export interface ImportEntry {
  title: string;
  status?: string;
  sprint?: string;
}

export function parseImportFile(filePath: string): ImportEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (cause) {
    throw new Error(`Cannot read import file "${filePath}"`, { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Import file "${filePath}" is not valid JSON`, { cause });
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Import file "${filePath}" must contain a JSON array of issues`);
  }

  parsed.forEach((entry, index) => {
    const title = (entry as Partial<ImportEntry> | null)?.title;
    if (typeof title !== "string" || title === "") {
      throw new Error(`Import entry #${index + 1} is missing a non-empty "title"`);
    }
  });

  return parsed as ImportEntry[];
}

export function importIssues(cwd: string, entries: ImportEntry[]): number[] {
  const sprints = readSprints(cwd);

  entries.forEach((entry, index) => {
    try {
      if (entry.status !== undefined) {
        assertIssueStatus(entry.status);
      }
      if (entry.sprint !== undefined && entry.sprint !== "") {
        assertSprintExists(sprints, entry.sprint);
      }
    } catch (cause) {
      throw new Error(
        `Import entry #${index + 1} ("${entry.title}"): ${(cause as Error).message}`,
      );
    }
  });

  const existing = readIssues(cwd);
  let id = existing.reduce((max, issue) => Math.max(max, issue.id), 0) + 1;
  const now = new Date().toISOString();
  const created: Issue[] = entries.map((entry) => ({
    id: id++,
    title: entry.title,
    status: (entry.status as IssueStatus | undefined) ?? "idea",
    sprint: entry.sprint ?? "",
    createdAt: now,
    updatedAt: now,
  }));

  writeIssues(cwd, [...existing, ...created]);
  return created.map((issue) => issue.id);
}

export function importFromFile(cwd: string, filePath: string): number[] {
  return importIssues(cwd, parseImportFile(filePath));
}
