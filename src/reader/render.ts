import type { ItemView, Plan, SprintGroup } from "./plan.js";

export function renderJson(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

export function renderPretty(plan: Plan): string {
  const lines: string[] = [];

  if (plan.filteredBySprint === undefined) {
    lines.push(`BACKLOG (${plan.backlog.length})`);
    for (const item of plan.backlog) {
      lines.push(renderItemLine(item));
    }
  }

  for (const sprint of plan.sprints) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(renderSprintHeader(sprint));
    lines.push(`  goal: ${sprint.goal}`);
    for (const item of sprint.items) {
      lines.push(renderItemLine(item));
    }
  }

  return lines.join("\n");
}

function renderSprintHeader(sprint: SprintGroup): string {
  const marker = sprint.active ? "▶ " : "  ";
  return `${marker}SPRINT ${sprint.name}   (${sprint.status})`;
}

function renderItemLine(item: ItemView): string {
  const specTag = item.hasSpec ? "  [spec]" : "";
  return `  #${item.id}  ${item.status.padEnd(5)} ${item.title}${specTag}`;
}
