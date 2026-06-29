import type { IssueStatus, SprintStatus } from "../../domain/types.js";
import type { IssueView, SprintGroup } from "../../reader/plan.js";

// Column order for the sprint board: queued work first, then in-progress, then done.
export const SPRINT_COLUMN_ORDER: readonly SprintStatus[] = ["planned", "active", "done"];

export type SprintColumns = Record<SprintStatus, SprintGroup[]>;

/**
 * Group sprints into the board's status columns, each ordered by position. Status is
 * already derived on every SprintGroup (see domain/sprintStatus.ts), so this is a pure
 * bucketing of the plan's sprints.
 */
export function groupSprintsByStatus(sprints: SprintGroup[]): SprintColumns {
  const inColumn = (status: SprintStatus) =>
    sprints.filter((s) => s.status === status).sort((a, b) => a.position - b.position);
  return { active: inColumn("active"), planned: inColumn("planned"), done: inColumn("done") };
}

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
