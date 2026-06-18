import fs from "node:fs";
import path from "node:path";
import type { Item } from "../domain/types.js";
import { itemsFilePath } from "./paths.js";

export function readItems(cwd: string): Item[] {
  const filePath = itemsFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as Item;
    } catch (cause) {
      throw new Error(`Malformed JSON in items.jsonl at line ${index + 1}`, { cause });
    }
  });
}

export function writeItems(cwd: string, items: Item[]): void {
  const filePath = itemsFilePath(cwd);
  const tempPath = path.join(path.dirname(filePath), `.items.jsonl.${process.pid}.tmp`);
  const content = items.map((item) => JSON.stringify(item)).join("\n");
  const trailing = items.length > 0 ? `${content}\n` : "";
  fs.writeFileSync(tempPath, trailing);
  fs.renameSync(tempPath, filePath);
}
