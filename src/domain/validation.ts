import { ITEM_STATUSES, SPRINT_STATUSES, type Item, type Sprint } from "./types.js";

export function assertSprintExists(sprints: Sprint[], name: string): void {
  if (!sprints.some((sprint) => sprint.name === name)) {
    throw new Error(`Sprint "${name}" does not exist`);
  }
}

export function assertItemExists(items: Item[], id: number): void {
  if (!items.some((item) => item.id === id)) {
    throw new Error(`Item #${id} does not exist`);
  }
}

export function assertSprintNameAvailable(sprints: Sprint[], name: string): void {
  if (sprints.some((sprint) => sprint.name === name)) {
    throw new Error(`Sprint "${name}" already exists`);
  }
}

export function assertItemStatus(status: string): void {
  if (!ITEM_STATUSES.includes(status as Item["status"])) {
    throw new Error(
      `Invalid item status "${status}" — must be one of: ${ITEM_STATUSES.join(", ")}`,
    );
  }
}

export function assertSprintStatus(status: string): void {
  if (!SPRINT_STATUSES.includes(status as Sprint["status"])) {
    throw new Error(
      `Invalid sprint status "${status}" — must be one of: ${SPRINT_STATUSES.join(", ")}`,
    );
  }
}
