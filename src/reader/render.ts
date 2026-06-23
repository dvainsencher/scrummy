import type { IssueView, Plan, SprintGroup } from "./plan.js";

export function renderJson(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

export function renderPretty(plan: Plan): string {
  const lines: string[] = [];

  if (plan.filteredBySprint === undefined) {
    lines.push(`BACKLOG (${plan.backlog.length})`);
    for (const issue of plan.backlog) {
      lines.push(renderIssueLine(issue));
    }
  }

  for (const sprint of plan.sprints) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(renderSprintHeader(sprint));
    lines.push(`  goal: ${sprint.goal}`);
    for (const issue of sprint.issues) {
      lines.push(renderIssueLine(issue));
    }
  }

  return lines.join("\n");
}

function renderSprintHeader(sprint: SprintGroup): string {
  const marker = sprint.active ? "▶ " : "  ";
  return `${marker}SPRINT ${sprint.name}   (${sprint.status})`;
}

export function renderIssueLine(issue: IssueView): string {
  const specTag = issue.hasSpec ? "  [spec]" : "";
  const logTag = issue.hasLog ? "  [log]" : "";
  return `  #${issue.id}  ${issue.status.padEnd(5)} ${issue.title}${specTag}${logTag}`;
}
