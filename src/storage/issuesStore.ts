import fs from "node:fs";
import type { Issue } from "../domain/types.js";
import { issuesDir, legacyIssuesFilePath } from "./paths.js";
import { readRecordDir, serializeRecord, syncRecordDir } from "./recordDir.js";

const ISSUE_KEYS = ["id", "title", "status", "sprint", "createdAt", "updatedAt"] as const;

function readLegacyIssues(cwd: string): Issue[] {
  const filePath = legacyIssuesFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as Issue;
    } catch (cause) {
      throw new Error(`Malformed JSON in issues.jsonl at line ${index + 1}`, { cause });
    }
  });
}

export function readIssues(cwd: string): Issue[] {
  // The directory wins once it exists; writeIssues removes the legacy file as it migrates,
  // so the two can never both be authoritative.
  const dir = issuesDir(cwd);
  const issues = fs.existsSync(dir) ? readRecordDir<Issue>(dir, "issues") : readLegacyIssues(cwd);
  // Sort by id so callers see a stable order regardless of directory iteration order.
  // Matches the old append-ordered JSONL, since ids are only ever allocated ascending.
  return issues.sort((a, b) => a.id - b.id);
}

export function writeIssues(cwd: string, issues: Issue[]): void {
  const files = new Map(issues.map((issue) => [`${issue.id}.json`, serializeRecord(issue, ISSUE_KEYS)]));
  syncRecordDir(issuesDir(cwd), files);
  fs.rmSync(legacyIssuesFilePath(cwd), { force: true });
}
