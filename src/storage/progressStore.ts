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
  const dir = progressDir(cwd);
  const entries = fs.existsSync(dir)
    ? readRecordDir<ProgressEntry>(dir, "progress")
    : readLegacyProgress(cwd);
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.issueId - b.issueId);
}

// One file per entry, under a per-issue directory. The random suffix is deliberate: two
// branches logging progress at the same instant must produce different filenames so the
// merge stays clean. A deterministic name would collide and conflict for no reason.
function entryFileName(entry: ProgressEntry): string {
  const stamp = entry.createdAt.replace(/[:.]/g, "-");
  return path.join(String(entry.issueId), `${stamp}-${crypto.randomBytes(4).toString("hex")}.json`);
}

function writeEntry(dir: string, entry: ProgressEntry): void {
  const filePath = path.join(dir, entryFileName(entry));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serializeRecord(entry, PROGRESS_KEYS));
}

/**
 * Materialize a legacy progress.jsonl as per-entry files. No-op once the directory exists.
 * Reading before the directory exists is what makes this lossless.
 */
export function migrateLegacyProgress(cwd: string): void {
  const dir = progressDir(cwd);
  if (fs.existsSync(dir) || !fs.existsSync(legacyProgressFilePath(cwd))) {
    return;
  }
  const entries = readLegacyProgress(cwd);
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of entries) {
    writeEntry(dir, entry);
  }
  fs.rmSync(legacyProgressFilePath(cwd), { force: true });
}

export function appendProgress(cwd: string, entry: ProgressEntry): void {
  migrateLegacyProgress(cwd);
  writeEntry(progressDir(cwd), entry);
}
