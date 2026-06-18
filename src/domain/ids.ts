import type { Item } from "./types.js";

export function nextId(items: Item[]): number {
  const maxId = items.reduce((max, item) => Math.max(max, item.id), 0);
  return maxId + 1;
}
