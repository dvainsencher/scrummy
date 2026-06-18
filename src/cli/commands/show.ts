import { buildPlan } from "../../reader/plan.js";
import { renderJson, renderPretty } from "../../reader/render.js";

export interface ShowOptions {
  sprint?: string;
  done?: boolean;
  json?: boolean;
}

export function show(cwd: string, options: ShowOptions): string {
  const plan = buildPlan(cwd, { sprint: options.sprint, done: options.done });
  return options.json ? renderJson(plan) : renderPretty(plan);
}
