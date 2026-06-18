import type { Item, Sprint } from "./types.js";

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
