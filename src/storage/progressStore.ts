import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ProgressEntry } from "../domain/types.js";
import { legacyProgressFilePath, progressDir } from "./paths.js";
import { readRecordDir, serializeRecord } from "./recordDir.js";

const PROGRESS_KEYS = ["issueId", "type", "message", "createdAt"] as const;

function readLegacyProgress(cwd: string): ProgressEntry[] {
  const filePath = legacyProgressFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as ProgressEntry;
    } catch (cause) {
      throw new Error(`Malformed JSON in progress.jsonl at line ${index + 1}`, { cause });
    }
  });
}

export function readProgress(cwd: string): ProgressEntry[] {
  // Legacy file outranks the directory while it exists — see issuesStore.readIssues for
  // why a partially migrated directory must never be treated as authoritative.
  const entries = fs.existsSync(legacyProgressFilePath(cwd))
    ? readLegacyProgress(cwd)
    : readRecordDir<ProgressEntry>(progressDir(cwd), "progress");
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.issueId - b.issueId);
}

// One file per entry, under a per-issue directory. The random suffix is deliberate: two
// branches logging progress at the same instant must produce different filenames so the
// merge stays clean. A deterministic name would collide and conflict for no reason.
function entryFileName(entry: ProgressEntry): string {
  const stamp = entry.createdAt.replace(/[:.]/g, "-");
  return path.join(String(entry.issueId), `${stamp}-${crypto.randomBytes(4).toString("hex")}.json`);
}

function writeEntryAt(dir: string, entry: ProgressEntry, relativePath: string): void {
  const filePath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serializeRecord(entry, PROGRESS_KEYS));
}

function writeEntry(dir: string, entry: ProgressEntry): void {
  writeEntryAt(dir, entry, entryFileName(entry));
}

/**
 * Materialize a legacy progress.jsonl as per-entry files. No-op once the legacy file is
 * gone — its removal, last, is what marks the migration complete.
 *
 * Names migrated entries by their position in the legacy file rather than randomly, so
 * re-running after an interrupted migration overwrites the same files instead of
 * duplicating every entry. It is also why two branches migrating the same log produce
 * identical filenames and merge cleanly.
 */
export function migrateLegacyProgress(cwd: string): void {
  if (!fs.existsSync(legacyProgressFilePath(cwd))) {
    return;
  }
  const dir = progressDir(cwd);
  const entries = readLegacyProgress(cwd);
  fs.mkdirSync(dir, { recursive: true });
  entries.forEach((entry, index) => {
    const stamp = entry.createdAt.replace(/[:.]/g, "-");
    writeEntryAt(dir, entry, path.join(String(entry.issueId), `${stamp}-${String(index).padStart(4, "0")}.json`));
  });
  fs.rmSync(legacyProgressFilePath(cwd), { force: true });
}

export function appendProgress(cwd: string, entry: ProgressEntry): void {
  migrateLegacyProgress(cwd);
  writeEntry(progressDir(cwd), entry);
}
