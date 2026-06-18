import fs from "node:fs";
import type { Item, Sprint } from "../domain/types.js";
import { assertSprintExists } from "../domain/validation.js";
import { specFilePath } from "../storage/paths.js";
import { readItems } from "../storage/itemsStore.js";
import { readSprints } from "../storage/sprintsStore.js";
import { backlogItems } from "./backlog.js";

export interface ItemView extends Item {
  hasSpec: boolean;
}

export interface SprintGroup extends Sprint {
  active: boolean;
  items: ItemView[];
}

export interface Plan {
  backlog: ItemView[];
  sprints: SprintGroup[];
  filteredBySprint?: string;
}

export interface BuildPlanOptions {
  sprint?: string;
  done?: boolean;
}

export function buildPlan(cwd: string, options: BuildPlanOptions): Plan {
  const items = readItems(cwd);
  const sprints = readSprints(cwd);

  if (options.sprint !== undefined) {
    assertSprintExists(sprints, options.sprint);
  }

  const toView = (item: Item): ItemView => ({
    ...item,
    hasSpec: fs.existsSync(specFilePath(cwd, item.id)),
  });

  const itemsForSprint = (sprintName: string): ItemView[] =>
    items
      .filter((item) => item.sprint === sprintName)
      .filter((item) => options.done || item.status !== "done")
      .sort((a, b) => a.id - b.id)
      .map(toView);

  const sprintGroups = sprints
    .filter((sprint) => options.sprint === undefined || sprint.name === options.sprint)
    .filter((sprint) => options.sprint !== undefined || options.done || sprint.status !== "done")
    .map((sprint) => ({
      ...sprint,
      active: sprint.status === "active",
      items: itemsForSprint(sprint.name),
    }))
    .sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }
      return a.position - b.position;
    });

  const backlog =
    options.sprint === undefined
      ? backlogItems(items)
          .filter((item) => options.done || item.status !== "done")
          .sort((a, b) => a.id - b.id)
          .map(toView)
      : [];

  return { backlog, sprints: sprintGroups, filteredBySprint: options.sprint };
}
