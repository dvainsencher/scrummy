import fs from "node:fs";
import { issuesFilePath, roadmapDir, specsDir } from "../../storage/paths.js";
import { readIssues, writeIssues } from "../../storage/issuesStore.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";
import { assertRoadmapDirNotForeign } from "../../domain/validation.js";

export function init(cwd: string): void {
  assertRoadmapDirNotForeign(roadmapDir(cwd), issuesFilePath(cwd));
  fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  fs.mkdirSync(specsDir(cwd), { recursive: true });
  if (readIssues(cwd).length === 0) {
    writeIssues(cwd, []);
  }
  if (readSprints(cwd).length === 0) {
    writeSprints(cwd, []);
  }
}
