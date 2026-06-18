import fs from "node:fs";
import path from "node:path";
import type { Sprint } from "../domain/types.js";
import { sprintsFilePath } from "./paths.js";

export function readSprints(cwd: string): Sprint[] {
  const filePath = sprintsFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as Sprint[];
}

export function writeSprints(cwd: string, sprints: Sprint[]): void {
  const filePath = sprintsFilePath(cwd);
  const tempPath = path.join(path.dirname(filePath), `.sprints.json.${process.pid}.tmp`);
  fs.writeFileSync(tempPath, `${JSON.stringify(sprints, null, 2)}\n`);
  fs.renameSync(tempPath, filePath);
}
