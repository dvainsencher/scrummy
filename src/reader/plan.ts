import fs from "node:fs";
import type { Issue, Sprint } from "../domain/types.js";
import { assertSprintExists } from "../domain/validation.js";
import { specFilePath } from "../storage/paths.js";
import { readIssues } from "../storage/issuesStore.js";
import { readProgress } from "../storage/progressStore.js";
import { readSprints } from "../storage/sprintsStore.js";
import { backlogIssues } from "./backlog.js";

export interface IssueView extends Issue {
  hasSpec: boolean;
  hasLog: boolean;
}

export interface SprintGroup extends Sprint {
  active: boolean;
  issues: IssueView[];
}

export interface Plan {
  backlog: IssueView[];
  sprints: SprintGroup[];
  filteredBySprint?: string;
}

export interface BuildPlanOptions {
  sprint?: string;
  done?: boolean;
}

export function buildPlan(cwd: string, options: BuildPlanOptions): Plan {
  const issues = readIssues(cwd);
  const sprints = readSprints(cwd);
  const progress = readProgress(cwd);

  if (options.sprint !== undefined) {
    assertSprintExists(sprints, options.sprint);
  }

  const toView = (issue: Issue): IssueView => ({
    ...issue,
    hasSpec: fs.existsSync(specFilePath(cwd, issue.id)),
    hasLog: progress.some((entry) => entry.issueId === issue.id),
  });

  const issuesForSprint = (sprintName: string): IssueView[] =>
    issues
      .filter((issue) => issue.sprint === sprintName)
      .filter((issue) => options.done || issue.status !== "done")
      .sort((a, b) => a.id - b.id)
      .map(toView);

  const sprintGroups = sprints
    .filter((sprint) => options.sprint === undefined || sprint.name === options.sprint)
    .filter((sprint) => options.sprint !== undefined || options.done || sprint.status !== "done")
    .map((sprint) => ({
      ...sprint,
      active: sprint.status === "active",
      issues: issuesForSprint(sprint.name),
    }))
    .sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }
      return a.position - b.position;
    });

  const backlog =
    options.sprint === undefined
      ? backlogIssues(issues)
          .filter((issue) => options.done || issue.status !== "done")
          .sort((a, b) => a.id - b.id)
          .map(toView)
      : [];

  return { backlog, sprints: sprintGroups, filteredBySprint: options.sprint };
}
