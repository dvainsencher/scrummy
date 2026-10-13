import fs from "node:fs";
import path from "node:path";
import type { Plan } from "../../reader/plan.js";
import { buildPlan } from "../../reader/plan.js";
import {
  issuesDir,
  legacyIssuesFilePath,
  legacyProgressFilePath,
  legacySprintsFilePath,
  progressDir,
  specsDir,
  sprintsDir,
} from "../../storage/paths.js";
import { buildKanbanData, type KanbanData } from "./kanban.js";

export interface ViewData {
  plan: Plan;
  data: KanbanData;
}

// The viewer must show the done column, so it always builds the plan with { done: true }.
// Lives here (not view.tsx) so the refresh loop and the initial load share one code path.
export function buildViewData(cwd: string): ViewData {
  const plan = buildPlan(cwd, { done: true });
  return { plan, data: buildKanbanData(plan) };
}

/** Rebuild the view data, or null if the files were caught mid-write (retry next tick). */
export function refreshViewData(cwd: string): ViewData | null {
  try {
    return buildViewData(cwd);
  } catch {
    return null;
  }
}

function statLine(file: string): string {
  try {
    const st = fs.statSync(file);
    return `${file}:${st.mtimeMs}:${st.size}`;
  } catch {
    return "";
  }
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // Writers stage `.<name>.<pid>.tmp` files and rename them; ignore those.
    if (entry.name.endsWith(".tmp")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

/**
 * Cheap change signal for everything the viewer renders: path + mtime + size of every
 * roadmap record file. Polling this beats fs.watch here — recursive watch is unreliable
 * across platforms, and tmp+rename writes would fire event storms.
 */
export function fingerprint(cwd: string): string {
  const files: string[] = [];
  for (const dir of [issuesDir(cwd), sprintsDir(cwd), progressDir(cwd), specsDir(cwd)]) {
    walk(dir, files);
  }
  files.push(legacyIssuesFilePath(cwd), legacySprintsFilePath(cwd), legacyProgressFilePath(cwd));
  return files.sort().map(statLine).filter(Boolean).join("\n");
}
