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
  // The legacy file outranks the directory while it exists. Deleting it is the migration's
  // commit point (see writeIssues), so its presence means the conversion has not finished
  // and the directory may hold only some of the records. Trusting a half-written directory
  // would report a truncated backlog as the whole truth — and the next write would then
  // delete the still-intact legacy file, destroying whatever never reached disk.
  //
  // Caveat: nothing recreates a legacy file once deleted, so this is only wrong if someone
  // restores an old one by hand into an already-migrated project — in which case the stale
  // content wins and syncRecordDir prunes the records missing from it. Delete the restored
  // legacy file rather than letting a mutating command consume it.
  const issues = fs.existsSync(legacyIssuesFilePath(cwd))
    ? readLegacyIssues(cwd)
    : readRecordDir<Issue>(issuesDir(cwd), "issues");
  // Sort by id so callers see a stable order regardless of directory iteration order.
  // Matches the old append-ordered JSONL, since ids are only ever allocated ascending.
  return issues.sort((a, b) => a.id - b.id);
}

export function writeIssues(cwd: string, issues: Issue[]): void {
  const files = new Map<string, string>();
  for (const issue of issues) {
    const fileName = `${issue.id}.json`;
    // Two records sharing an id map to one file, so a silent overwrite would drop one.
    // Duplicates can only arrive out-of-band (a bad merge resolution); refusing to write
    // keeps them recoverable instead of deleting one on the next mutation.
    if (files.has(fileName)) {
      // Name the file the duplicate actually lives in. Before migration that is still the
      // legacy JSONL, and pointing at the directory would send the user to a path that
      // does not exist yet — with every mutating command blocked until they fix it, since
      // the migration runs before each one.
      const location = fs.existsSync(legacyIssuesFilePath(cwd))
        ? "docs/roadmap/issues.jsonl"
        : "docs/roadmap/issues/";
      throw new Error(
        `Duplicate issue id #${issue.id} — refusing to write, one record would be lost. ` +
          `Remove the duplicate in ${location}, then re-run. "scrummy validate" lists them.`,
      );
    }
    files.set(fileName, serializeRecord(issue, ISSUE_KEYS));
  }
  syncRecordDir(issuesDir(cwd), files);
  // Last: removing the legacy file is what marks the migration complete.
  fs.rmSync(legacyIssuesFilePath(cwd), { force: true });
}
