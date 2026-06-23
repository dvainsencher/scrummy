import fs from "node:fs";
import path from "node:path";
import type { ProgressEntry } from "../domain/types.js";
import { progressFilePath } from "./paths.js";

export function readProgress(cwd: string): ProgressEntry[] {
  const filePath = progressFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as ProgressEntry;
    } catch (cause) {
      throw new Error(`Malformed JSON in progress.jsonl at line ${index + 1}`, { cause });
    }
  });
}

export function appendProgress(cwd: string, entry: ProgressEntry): void {
  const filePath = progressFilePath(cwd);
  const entries = [...readProgress(cwd), entry];
  const tempPath = path.join(path.dirname(filePath), `.progress.jsonl.${process.pid}.tmp`);
  const content = entries.map((e) => JSON.stringify(e)).join("\n");
  fs.writeFileSync(tempPath, `${content}\n`);
  fs.renameSync(tempPath, filePath);
}
