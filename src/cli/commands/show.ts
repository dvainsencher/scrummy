import { buildPlan, getIssue } from "../../reader/plan.js";
import { renderIssueLine, renderJson, renderPretty } from "../../reader/render.js";

export interface ShowOptions {
  id?: number;
  sprint?: string;
  done?: boolean;
  json?: boolean;
}

export function show(cwd: string, options: ShowOptions): string {
  if (options.id !== undefined) {
    const issue = getIssue(cwd, options.id);
    if (options.json) {
      return JSON.stringify(issue, null, 2);
    }
    const location = issue.sprint ? `sprint: ${issue.sprint}` : "backlog";
    return `${renderIssueLine(issue)}\n  ${location}`;
  }
  const plan = buildPlan(cwd, { sprint: options.sprint, done: options.done });
  return options.json ? renderJson(plan) : renderPretty(plan);
}
