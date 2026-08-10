// One-shot migration from the pre-directory layout (issues.jsonl / sprints.json /
// progress.jsonl) to one file per record. See storage/recordDir.ts for why the layout changed.
//
// Each store can also fall back to reading its legacy file on its own, which is what keeps
// *reads* working before any migration happens. This exists so the conversion is a single
// atomic event instead: without it, each store would migrate only when something happened
// to write it, so a project would sit half-converted across many commits — issues migrated,
// sprints not — which is confusing to review and pointless to spread out.
//
// Runs inside the roadmap lock (see bin/scrummy.ts), so no other process can observe a
// partially converted state. Idempotent: three existence checks once converted.
import fs from "node:fs";
import { readIssues, writeIssues } from "./issuesStore.js";
import { migrateLegacyProgress } from "./progressStore.js";
import { readSprints, writeSprints } from "./sprintsStore.js";
import {
  legacyIssuesFilePath,
  legacySprintsFilePath,
  roadmapDir,
} from "./paths.js";

export function migrateRoadmapLayout(cwd: string): void {
  if (!fs.existsSync(roadmapDir(cwd))) {
    return; // nothing initialized yet
  }
  // Read through the legacy fallback, write through the directory writer, which removes
  // the legacy file as its last step.
  if (fs.existsSync(legacyIssuesFilePath(cwd))) {
    writeIssues(cwd, readIssues(cwd));
  }
  if (fs.existsSync(legacySprintsFilePath(cwd))) {
    writeSprints(cwd, readSprints(cwd));
  }
  migrateLegacyProgress(cwd);
}
