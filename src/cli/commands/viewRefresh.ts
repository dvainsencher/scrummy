import type { Plan } from "../../reader/plan.js";
import { buildPlan } from "../../reader/plan.js";
import { fingerprint } from "../../storage/watch.js";
import { buildKanbanData, type KanbanData } from "./kanban.js";

export interface ViewData {
  plan: Plan;
  data: KanbanData;
  /** Fingerprint taken *before* reading, so a write racing the load is picked up by the next poll. */
  fingerprint: string;
}

// The viewer must show the done column, so it always builds the plan with { done: true }.
// Lives here (not view.tsx) so the refresh loop and the initial load share one code path.
export function buildViewData(cwd: string): ViewData {
  const stamp = fingerprint(cwd);
  const plan = buildPlan(cwd, { done: true });
  return { plan, data: buildKanbanData(plan), fingerprint: stamp };
}

/** Rebuild the view data, or null if the files were caught mid-write (retry next tick). */
export function refreshViewData(cwd: string): ViewData | null {
  try {
    return buildViewData(cwd);
  } catch {
    return null;
  }
}
