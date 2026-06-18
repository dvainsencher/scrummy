import fs from "node:fs";
import { roadmapDir, specsDir } from "../../storage/paths.js";
import { readItems, writeItems } from "../../storage/itemsStore.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export function init(cwd: string): void {
  fs.mkdirSync(roadmapDir(cwd), { recursive: true });
  fs.mkdirSync(specsDir(cwd), { recursive: true });
  if (readItems(cwd).length === 0) {
    writeItems(cwd, []);
  }
  if (readSprints(cwd).length === 0) {
    writeSprints(cwd, []);
  }
}
