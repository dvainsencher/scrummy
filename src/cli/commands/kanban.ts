import type { IssueStatus } from "../../domain/types.js";
import type { IssueView, SprintGroup } from "../../reader/plan.js";

export interface KanbanColumns {
  idea: IssueView[];
  ready: IssueView[];
  doing: IssueView[];
  done: IssueView[];
}

export interface KanbanData {
  sprintName: string | null;
  columns: KanbanColumns;
  allSprints: SprintGroup[];
}

interface PlanSnapshot {
  sprints: SprintGroup[];
  backlog: IssueView[];
}

function groupByStatus(issues: IssueView[]): KanbanColumns {
  const sorted = [...issues].sort((a, b) => a.id - b.id);
  const bucket = (s: IssueStatus) => sorted.filter((i) => i.status === s);
  return {
    idea: bucket("idea"),
    ready: bucket("ready"),
    doing: bucket("doing"),
    done: bucket("done"),
  };
}

export function buildKanbanData(plan: PlanSnapshot): KanbanData {
  const activeSprint = plan.sprints.find((s) => s.active) ?? null;
  const issues = activeSprint ? activeSprint.issues : plan.backlog;
  return {
    sprintName: activeSprint?.name ?? null,
    columns: groupByStatus(issues),
    allSprints: plan.sprints,
  };
}

export function selectKanbanView(plan: PlanSnapshot, sprintName: string | null): KanbanData {
  if (sprintName === null) {
    return {
      sprintName: null,
      columns: groupByStatus(plan.backlog),
      allSprints: plan.sprints,
    };
  }
  const sprint = plan.sprints.find((s) => s.name === sprintName);
  if (!sprint) {
    return buildKanbanData(plan);
  }
  return {
    sprintName: sprint.name,
    columns: groupByStatus(sprint.issues),
    allSprints: plan.sprints,
  };
}
