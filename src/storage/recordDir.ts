// Directory-backed record storage: one JSON file per record.
//
// This exists for git's benefit, not the filesystem's. When every record shared one JSONL
// file, git saw unrelated edits as adjacent-line changes and refused to merge them —
// measured on real three-way merges: `add-issue` vs `set-status` on the last issue
// conflicted, and even two `add-issue` calls that allocated *different* ids (6 and 7)
// conflicted. Splitting records into files makes those merge cleanly while genuine
// collisions (same id, or the same record edited on both sides) still conflict, which is
// exactly the behaviour you want from a backlog shared across branches.
//
// Pretty-printed on purpose: one field per line means a status change is a one-line diff
// rather than a whole-record rewrite, which keeps merges clean at field granularity too.
import fs from "node:fs";
import path from "node:path";

export function serializeRecord<T>(record: T, keyOrder: readonly (keyof T & string)[]): string {
  return `${JSON.stringify(record, [...keyOrder], 2)}\n`;
}

function jsonFilesIn(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".json"))
    .sort();
}

/** Read every *.json under `dir` (recursively). Returns [] if the directory is absent. */
export function readRecordDir<T>(dir: string, label: string): T[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return jsonFilesIn(dir).map((entry) => {
    const filePath = path.join(dir, entry);
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    } catch (cause) {
      throw new Error(`Malformed JSON in ${label}/${entry}`, { cause });
    }
  });
}

/**
 * Make `dir` contain exactly `files` (relative path → content).
 *
 * Only rewrites files whose content actually changed. That is load-bearing, not an
 * optimization: rewriting every record on every mutation would put every record in every
 * commit and reintroduce precisely the merge conflicts this layout exists to remove.
 */
export function syncRecordDir(dir: string, files: ReadonlyMap<string, string>): void {
  fs.mkdirSync(dir, { recursive: true });

  for (const [relativePath, content] of files) {
    const filePath = path.join(dir, relativePath);
    let existing: string | undefined;
    try {
      existing = fs.readFileSync(filePath, "utf8");
    } catch {
      existing = undefined;
    }
    if (existing === content) {
      continue;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
  }

  for (const entry of jsonFilesIn(dir)) {
    if (!files.has(entry)) {
      fs.rmSync(path.join(dir, entry), { force: true });
    }
  }
}
